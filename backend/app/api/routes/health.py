from datetime import datetime

from fastapi import APIRouter

from app.schemas.common import ApiResponse

router = APIRouter()


@router.get("/health", response_model=ApiResponse)
def health_check() -> ApiResponse:
    return ApiResponse(message="服务运行正常，任务2基础骨架已就绪", timestamp=datetime.now())
