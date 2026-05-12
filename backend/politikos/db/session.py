"""SQLModel engine + session helpers."""

from collections.abc import Iterator
from contextlib import contextmanager

from sqlmodel import Session, SQLModel, create_engine

from ..config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True, echo=False)


def init_db() -> None:
    """Create all tables. Replace with Alembic once schema stabilizes."""
    # Import models so SQLModel.metadata sees them
    from . import models  # noqa: F401

    SQLModel.metadata.create_all(engine)


@contextmanager
def session_scope() -> Iterator[Session]:
    s = Session(engine)
    try:
        yield s
        s.commit()
    except Exception:
        s.rollback()
        raise
    finally:
        s.close()
