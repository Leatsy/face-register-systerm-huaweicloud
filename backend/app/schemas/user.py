from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_no: str
    name: str
    phone: str | None
    avatar_url: str | None
    created_at: datetime
