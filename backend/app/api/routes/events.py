from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.datetime_utils import now_utc_naive
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.attendance_event import AttendanceEvent
from app.models.user import User
from app.schemas.event import AttendanceEventCreate, AttendanceEventOut

router = APIRouter()


@router.get("", response_model=list[AttendanceEventOut])
def list_events(
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
) -> list[AttendanceEventOut]:
    statement = select(AttendanceEvent)

    if active_only:
        now = now_utc_naive()
        statement = statement.where(AttendanceEvent.start_time <= now, AttendanceEvent.end_time >= now)

    statement = statement.order_by(AttendanceEvent.start_time.asc(), AttendanceEvent.id.desc())
    return list(db.scalars(statement).all())


@router.post("", response_model=AttendanceEventOut, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: AttendanceEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AttendanceEventOut:
    published_at = now_utc_naive()
    if payload.end_time <= published_at:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="结束时间必须晚于开始时间")

    event = AttendanceEvent(
        created_by_user_id=current_user.id,
        title=payload.title.strip(),
        description=payload.description.strip(),
        start_time=published_at,
        end_time=payload.end_time,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
