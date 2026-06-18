from datetime import datetime

from pydantic import BaseModel


class MessageResponse(BaseModel):
    message: str


class ApiResponse(BaseModel):
    success: bool = True
    message: str
    timestamp: datetime
