from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    attendance_event_id: Mapped[int | None] = mapped_column(ForeignKey("attendance_events.id"), nullable=True, index=True)
    snapshot_url: Mapped[str] = mapped_column(String(255))
    match_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    message: Mapped[str] = mapped_column(String(255), default="等待任务3接入识别逻辑")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="attendance_records")
    attendance_event = relationship("AttendanceEvent", back_populates="attendance_records")
