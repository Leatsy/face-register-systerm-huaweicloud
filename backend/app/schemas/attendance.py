from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.event import AttendanceEventOut


class AttendanceRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None
    attendance_event_id: int | None
    snapshot_url: str
    match_score: float | None
    status: str
    message: str
    created_at: datetime
    attendance_event: AttendanceEventOut | None = None


class CheckInResponse(BaseModel):
    success: bool
    message: str
    record: AttendanceRecordOut
