import json
from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np
from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.face_embedding import FaceEmbedding
from app.models.user import User
from app.services.storage import load_file_bytes

FACE_MODEL_NAME = "opencv-lite-v1"
MATCH_THRESHOLD = 0.92
FACE_SIZE = 128
FEATURE_SIZE = 16
HIST_BINS = 32
_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")


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
    vector = _extract_face_signature(content)
    if vector is None:
        return None, "opencv-lite-no-face"
    return _serialize_embedding(vector), FACE_MODEL_NAME


def recognize_user_from_upload(upload_file: UploadFile, db: Session) -> RecognitionResult:
    content = upload_file.file.read()
    upload_file.file.seek(0)

    signature = _extract_face_signature(content)
    if signature is None:
        return RecognitionResult(matched_user=None, score=None, message="未检测到清晰人脸，请重新拍照")

    embeddings = list(db.scalars(select(FaceEmbedding).order_by(FaceEmbedding.id.desc())).all())
    best_user: User | None = None
    best_score = -1.0

    for embedding in embeddings:
        user_signature = _ensure_embedding_vector(db, embedding)
        if user_signature is None:
            continue

        score = _cosine_similarity(signature, user_signature)
        if score > best_score:
            best_score = score
            best_user = embedding.user

    if best_user is None or best_score < MATCH_THRESHOLD:
        return RecognitionResult(matched_user=None, score=max(best_score, 0.0) if best_score >= 0 else None, message="未识别到已录入用户")

    return RecognitionResult(matched_user=best_user, score=best_score, message=f"签到成功，识别为 {best_user.name}")


def _ensure_embedding_vector(db: Session, embedding: FaceEmbedding) -> np.ndarray | None:
    if embedding.embedding_json:
        return _deserialize_embedding(embedding.embedding_json)

    try:
        content = load_file_bytes(embedding.image_url)
    except Exception:
        return None

    vector = _extract_face_signature(content)
    if vector is None:
        return None

    embedding.embedding_json = _serialize_embedding(vector)
    embedding.model_name = FACE_MODEL_NAME
    db.add(embedding)
    db.flush()
    return vector


def _extract_face_signature(content: bytes) -> np.ndarray | None:
    image_array = np.frombuffer(content, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        return None

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    face = _detect_primary_face(gray)
    if face is not None:
        x, y, w, h = face
        gray = gray[y : y + h, x : x + w]

    face_crop = cv2.resize(gray, (FACE_SIZE, FACE_SIZE), interpolation=cv2.INTER_AREA)
    face_crop = cv2.GaussianBlur(face_crop, (3, 3), 0)

    feature = cv2.resize(face_crop, (FEATURE_SIZE, FEATURE_SIZE), interpolation=cv2.INTER_AREA).astype(np.float32).flatten()
    histogram = cv2.calcHist([face_crop], [0], None, [HIST_BINS], [0, 256]).astype(np.float32).flatten()

    feature = _normalize(feature)
    histogram = _normalize(histogram)
    signature = np.concatenate([feature, histogram])
    return _normalize(signature)


def _detect_primary_face(gray: np.ndarray) -> tuple[int, int, int, int] | None:
    faces = _CASCADE.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    if len(faces) == 0:
        return None
    return max(faces, key=lambda item: item[2] * item[3])


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
