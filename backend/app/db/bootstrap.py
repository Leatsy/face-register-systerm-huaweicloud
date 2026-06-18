from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.db.base import Base


def initialize_database(engine: Engine) -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_attendance_record_extensions(engine)


def _ensure_attendance_record_extensions(engine: Engine) -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "attendance_records" not in table_names:
        return

    column_names = {column["name"] for column in inspector.get_columns("attendance_records")}
    if "attendance_event_id" in column_names:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE attendance_records ADD COLUMN attendance_event_id INTEGER"))
