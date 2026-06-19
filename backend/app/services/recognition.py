import json
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import cv2
import numpy as np
from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.face_embedding import FaceEmbedding
from app.models.user import User
from app.services.storage import load_file_bytes

settings = get_settings()
FACE_MODEL_NAME = f"insightface-{settings.face_model_name}"


@dataclass
class RecognitionResult:
    matched_user: User | None
    score: float | None
    message: str


def build_embedding_from_upload(upload_file: UploadFile) -> tuple[str | None, str]:
    content = upload_file.file.read()
    upload_file.file.seek(0)
    return build_embedding_from_bytes(content)


def build_embedding_from_bytes(content: bytes) -> tuple[str | None, str]:
    vector = _extract_face_embedding(content)
    if vector is None:
        return None, f"{FACE_MODEL_NAME}-no-face"
    return _serialize_embedding(vector), FACE_MODEL_NAME


def recognize_user_from_upload(upload_file: UploadFile, db: Session) -> RecognitionResult:
    content = upload_file.file.read()
    upload_file.file.seek(0)

    query_embedding = _extract_face_embedding(content)
    if query_embedding is None:
        return RecognitionResult(matched_user=None, score=None, message="未检测到清晰人脸，请重新拍照")

    embeddings = list(db.scalars(select(FaceEmbedding).order_by(FaceEmbedding.id.desc())).all())
    best_user: User | None = None
    best_score = -1.0

    for embedding in embeddings:
        user_signature = _ensure_embedding_vector(db, embedding)
        if user_signature is None:
            continue

        score = _cosine_similarity(query_embedding, user_signature)
        if score > best_score:
            best_score = score
            best_user = embedding.user

    if best_user is None or best_score < settings.face_match_threshold:
        return RecognitionResult(matched_user=None, score=max(best_score, 0.0) if best_score >= 0 else None, message="未识别到已录入用户")

    return RecognitionResult(matched_user=best_user, score=best_score, message=f"签到成功，识别为 {best_user.name}")


def _ensure_embedding_vector(db: Session, embedding: FaceEmbedding) -> np.ndarray | None:
    if embedding.embedding_json and embedding.model_name == FACE_MODEL_NAME:
        return _deserialize_embedding(embedding.embedding_json)

    try:
        content = load_file_bytes(embedding.image_url)
    except Exception:
        return None

    vector = _extract_face_embedding(content)
    if vector is None:
        return None

    embedding.embedding_json = _serialize_embedding(vector)
    embedding.model_name = FACE_MODEL_NAME
    db.add(embedding)
    db.flush()
    return vector


@lru_cache(maxsize=1)
def _get_face_analyzer() -> Any:
    try:
        from insightface.app import FaceAnalysis
    except ImportError as exc:
        raise RuntimeError("未安装 InsightFace 依赖，请先安装 insightface 和 onnxruntime") from exc

    providers = settings.face_provider_list or ["CPUExecutionProvider"]
    ctx_id = 0 if any("CUDA" in provider or "Tensorrt" in provider for provider in providers) else -1
    settings.face_model_root_path.mkdir(parents=True, exist_ok=True)

    analyzer = FaceAnalysis(
        name=settings.face_model_name,
        root=str(settings.face_model_root_path),
        providers=providers,
    )
    analyzer.prepare(
        ctx_id=ctx_id,
        det_thresh=settings.face_detect_threshold,
        det_size=(settings.face_detection_size, settings.face_detection_size),
    )
    return analyzer


def _extract_face_embedding(content: bytes) -> np.ndarray | None:
    image_array = np.frombuffer(content, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        return None

    faces = _get_face_analyzer().get(image)
    if not faces:
        return None

    best_face = max(faces, key=_face_priority)
    if float(getattr(best_face, "det_score", 0.0)) < settings.face_detect_threshold:
        return None

    embedding = np.asarray(best_face.embedding, dtype=np.float32)
    return _normalize(embedding)


def _face_priority(face: Any) -> float:
    bbox = np.asarray(getattr(face, "bbox", [0, 0, 0, 0]), dtype=np.float32)
    width = max(float(bbox[2] - bbox[0]), 1.0)
    height = max(float(bbox[3] - bbox[1]), 1.0)
    det_score = float(getattr(face, "det_score", 0.0))
    return width * height * max(det_score, 0.1)


def _normalize(vector: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(vector)
    if norm <= 1e-8:
        return vector
    return vector / norm


def _cosine_similarity(left: np.ndarray, right: np.ndarray) -> float:
    return float(np.dot(left, right))


def _serialize_embedding(vector: np.ndarray) -> str:
    return json.dumps(vector.tolist())


def _deserialize_embedding(payload: str) -> np.ndarray:
    data: Any = json.loads(payload)
    return np.asarray(data, dtype=np.float32)
