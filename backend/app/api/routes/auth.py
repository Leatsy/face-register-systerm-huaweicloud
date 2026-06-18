from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.face_embedding import FaceEmbedding
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.common import MessageResponse
from app.schemas.user import UserOut
from app.services.recognition import build_embedding_from_upload
from app.services.storage import save_upload_file

router = APIRouter()


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(
    student_no: str = Form(...),
    name: str = Form(...),
    phone: str = Form(""),
    password: str = Form(...),
    face_photo: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> UserOut:
    existing_user = db.scalar(select(User).where(User.student_no == student_no))
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="学号/工号已存在")

    embedding_json, model_name = build_embedding_from_upload(face_photo)
    if embedding_json is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="标准照片中未检测到清晰人脸")
    avatar_url = save_upload_file(face_photo, folder="avatars")

    user = User(
        student_no=student_no,
        name=name,
        phone=phone or None,
        password_hash=hash_password(password),
        avatar_url=avatar_url,
    )
    db.add(user)
    db.flush()

    face_embedding = FaceEmbedding(
        user_id=user.id,
        image_url=avatar_url,
        embedding_json=embedding_json,
        model_name=model_name,
    )
    db.add(face_embedding)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.student_no == payload.student_no))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号或密码错误")

    return TokenResponse(access_token=create_access_token(user.id), user=user)


@router.post("/logout", response_model=MessageResponse)
def logout() -> MessageResponse:
    return MessageResponse(message="注销成功，请在客户端删除本地 token")
