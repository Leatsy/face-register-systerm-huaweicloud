from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.datetime_utils import now_utc_naive
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.attendance import AttendanceRecord
from app.models.attendance_event import AttendanceEvent
from app.models.user import User
from app.schemas.attendance import AttendanceRecordOut, CheckInResponse
from app.services.recognition import recognize_user_from_upload
from app.services.storage import save_upload_file

router = APIRouter()


@router.post("/check-in", response_model=CheckInResponse)
def check_in(
    attendance_event_id: int = Form(...),
    face_photo: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> CheckInResponse:
    event = db.get(AttendanceEvent, attendance_event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="签到事件不存在")

    now = now_utc_naive()
    if event.start_time > now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="签到尚未开始")
    if event.end_time < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="签到事件已结束")

    recognition = recognize_user_from_upload(face_photo, db)
    snapshot_url = save_upload_file(face_photo, folder="checkins")

    existing_record = None
    if recognition.matched_user is not None:
        existing_record = db.scalar(
            select(AttendanceRecord).where(
                AttendanceRecord.attendance_event_id == event.id,
                AttendanceRecord.user_id == recognition.matched_user.id,
                AttendanceRecord.status == "success",
            )
        )

    if existing_record is not None:
        return CheckInResponse(
            success=True,
            message=f"{recognition.matched_user.name} 已签到，无需重复提交",
            record=existing_record,
        )

    record = AttendanceRecord(
        user_id=recognition.matched_user.id if recognition.matched_user is not None else None,
        attendance_event_id=event.id,
        snapshot_url=snapshot_url,
        match_score=recognition.score,
        status="success" if recognition.matched_user is not None else "unknown",
        message=recognition.message,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return CheckInResponse(
        success=recognition.matched_user is not None,
        message=recognition.message,
        record=record,
    )


@router.get("/records", response_model=list[AttendanceRecordOut])
def list_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AttendanceRecordOut]:
    statement = (
        select(AttendanceRecord)
        .where(AttendanceRecord.user_id == current_user.id)
        .order_by(AttendanceRecord.id.desc())
    )
    return list(db.scalars(statement).all())
