from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from app.core.datetime_utils import to_utc_naive, utc_naive_to_aware


class AttendanceEventBase(BaseModel):
    title: str = Field(min_length=1, max_length=128)
    description: str = Field(default="", max_length=2000)
    end_time: datetime

    @field_validator("end_time", mode="before")
    @classmethod
    def normalize_event_time(cls, value: datetime | str) -> datetime:
        if isinstance(value, str):
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return to_utc_naive(value)


class AttendanceEventCreate(AttendanceEventBase):
    pass


class AttendanceEventOut(AttendanceEventBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_by_user_id: int
    start_time: datetime
    created_at: datetime
    updated_at: datetime

    @field_serializer("start_time", "end_time", "created_at", "updated_at")
    def serialize_event_time(self, value: datetime) -> str:
        return utc_naive_to_aware(value).isoformat().replace("+00:00", "Z")
