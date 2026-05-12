"""SQLModel definitions — see docs/data-model.md for the source of truth."""

from datetime import datetime
from typing import Any

from sqlalchemy import Column, Index, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlmodel import Field, SQLModel


class RaceCache(SQLModel, table=True):
    __tablename__ = "race_cache"

    civicapi_id: str = Field(primary_key=True)
    country: str = Field(index=True)
    province: str | None = Field(default=None, index=True)
    district: str | None = None
    municipality: str | None = None
    election_name: str
    # Office (e.g. "Governor", "Sheriff"). search.type / detail.election_type.
    office: str = Field(index=True)
    # Scope ("Primary" | "Statewide" | ...). search.election_type / detail.election_scope.
    scope: str | None = Field(default=None, index=True)
    election_date: datetime = Field(index=True)
    polls_open: datetime | None = None
    polls_close: datetime | None = None
    has_breakdown: bool = False
    has_map: bool = False
    seats: int | None = None
    percent_reporting: int = 0
    winner_names: list[str] = Field(
        default_factory=list,
        sa_column=Column(ARRAY(Text), nullable=False, server_default="{}"),
    )
    is_disputed: bool = False
    raw_json: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB))
    payload_hash: str
    fetched_at: datetime
    discovered_at: datetime

    __table_args__ = (
        Index("ix_race_cache_country_province", "country", "province"),
        Index(
            "ix_race_cache_active",
            "election_date",
            postgresql_where="percent_reporting < 100",
        ),
    )


class Snapshot(SQLModel, table=True):
    __tablename__ = "snapshot"

    id: int | None = Field(default=None, primary_key=True)
    civicapi_id: str = Field(foreign_key="race_cache.civicapi_id", index=True)
    taken_at: datetime
    percent_reporting: int
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB))
    payload_hash: str

    __table_args__ = (
        Index("ix_snapshot_race_taken", "civicapi_id", "taken_at"),
    )


class DiffEvent(SQLModel, table=True):
    __tablename__ = "diff_event"

    id: int | None = Field(default=None, primary_key=True)
    civicapi_id: str = Field(foreign_key="race_cache.civicapi_id", index=True)
    occurred_at: datetime = Field(index=True)
    kind: str = Field(index=True)
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSONB))
