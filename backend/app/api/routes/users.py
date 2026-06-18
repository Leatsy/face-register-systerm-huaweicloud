from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.face_embedding import FaceEmbedding
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.user import UserOut
from app.services.recognition import build_embedding_from_upload
from app.services.storage import save_upload_file

router = APIRouter()


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)) -> UserOut:
    return current_user


@router.post("/me/face-photo", response_model=MessageResponse)
def update_face_photo(
    face_photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    # #region debug-point E:update-face-photo-entry
    import json, urllib.request
    _current_pos = face_photo.file.tell()
    face_photo.file.seek(0, 2)
    _file_size = face_photo.file.tell()
    face_photo.file.seek(_current_pos)
    try:
        urllib.request.urlopen(
            urllib.request.Request(
                "http://172.19.21.113:7777/event",
                data=json.dumps(
                    {
                        "sessionId": "mobile-register-html",
                        "runId": "pre-fix",
                        "hypothesisId": "E",
                        "location": "backend/app/api/routes/users.py:update_face_photo",
                        "msg": "[DEBUG] update face photo endpoint received request",
                        "data": {
                            "user_id": current_user.id,
                            "filename": face_photo.filename,
                            "content_type": face_photo.content_type,
                            "file_size": _file_size,
                        },
                    }
                ).encode(),
                headers={"Content-Type": "application/json"},
            ),
            timeout=2,
        ).read()
    except Exception:
        pass
    # #endregion
    embedding_json, model_name = build_embedding_from_upload(face_photo)
    if embedding_json is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="标准照片中未检测到清晰人脸")
    avatar_url = save_upload_file(face_photo, folder="avatars")

    current_user.avatar_url = avatar_url

    embedding = FaceEmbedding(
        user_id=current_user.id,
        image_url=avatar_url,
        embedding_json=embedding_json,
        model_name=model_name,
    )
    db.add(embedding)
    db.commit()
    return MessageResponse(message="标准人脸照片已更新，人脸特征已重新录入")
