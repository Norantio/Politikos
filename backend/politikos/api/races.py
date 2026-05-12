"""GET /api/races, /api/races/{id}, /api/races/{id}/snapshots, /history."""

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from sqlalchemy import or_
from sqlmodel import desc, select

from ..db.models import RaceCache, Snapshot
from ..db.session import session_scope

router = APIRouter(prefix="/races", tags=["races"])


def _serialize(rc: RaceCache) -> dict[str, Any]:
    return {
        "id": rc.civicapi_id,
        "country": rc.country,
        "province": rc.province,
        "district": rc.district,
        "municipality": rc.municipality,
        "election_name": rc.election_name,
        "office": rc.office,
        "scope": rc.scope,
        "election_date": rc.election_date.isoformat() if rc.election_date else None,
        "polls_open": rc.polls_open.isoformat() if rc.polls_open else None,
        "polls_close": rc.polls_close.isoformat() if rc.polls_close else None,
        "has_breakdown": rc.has_breakdown,
        "has_map": rc.has_map,
        "seats": rc.seats,
        "percent_reporting": rc.percent_reporting,
        "winner_names": rc.winner_names,
        "is_disputed": rc.is_disputed,
        "fetched_at": rc.fetched_at.isoformat() if rc.fetched_at else None,
    }


@router.get("")
async def list_races(
    province: str | None = Query(None, description="USPS state code, e.g. FL"),
    district: str | None = Query(None, description="District/county filter (exact)"),
    municipality: str | None = Query(None, description="Municipality filter (exact)"),
    q: str | None = Query(None, description="Free-text search across name/office/district/municipality"),
    office: str | None = Query(None, description="Office filter, e.g. 'Sheriff'"),
    scope: str | None = Query(None, description="'Primary' or 'Statewide'"),
    election_date: str | None = Query(None, description="ISO date, exact match"),
    active_only: bool = Query(False, description="Only races with reporting<100 today"),
    limit: int = Query(200, ge=1, le=5000),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    with session_scope() as s:
        stmt = select(RaceCache)
        if province:
            stmt = stmt.where(RaceCache.province == province.upper())
        if district:
            stmt = stmt.where(RaceCache.district == district)
        if municipality:
            stmt = stmt.where(RaceCache.municipality == municipality)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(or_(
                RaceCache.election_name.ilike(like),
                RaceCache.office.ilike(like),
                RaceCache.district.ilike(like),
                RaceCache.municipality.ilike(like),
            ))
        if office:
            stmt = stmt.where(RaceCache.office == office)
        if scope:
            stmt = stmt.where(RaceCache.scope == scope)
        if election_date:
            try:
                d = datetime.fromisoformat(election_date).date()
            except ValueError as exc:
                raise HTTPException(400, f"bad election_date: {exc}")
            day_start = datetime.combine(d, datetime.min.time(), tzinfo=timezone.utc)
            day_end = datetime.combine(d, datetime.max.time(), tzinfo=timezone.utc)
            stmt = stmt.where(
                RaceCache.election_date >= day_start, RaceCache.election_date <= day_end
            )
        if active_only:
            today_start = datetime.combine(
                datetime.now(timezone.utc).date(), datetime.min.time(), tzinfo=timezone.utc
            )
            today_end = today_start.replace(hour=23, minute=59, second=59)
            stmt = stmt.where(
                RaceCache.election_date >= today_start,
                RaceCache.election_date <= today_end,
                RaceCache.percent_reporting < 100,
            )
        stmt = stmt.order_by(desc(RaceCache.election_date)).offset(offset).limit(limit)
        rows = list(s.exec(stmt))
        return {"count": len(rows), "races": [_serialize(r) for r in rows]}


@router.get("/{race_id}")
async def get_race(race_id: str) -> dict[str, Any]:
    with session_scope() as s:
        rc = s.get(RaceCache, race_id)
        if rc is None:
            raise HTTPException(404, "race not found")
        out = _serialize(rc)
        out["raw"] = rc.raw_json
        return out


@router.get("/{race_id}/snapshots")
async def list_snapshots(
    race_id: str, limit: int = Query(500, ge=1, le=5000)
) -> dict[str, Any]:
    with session_scope() as s:
        stmt = (
            select(Snapshot)
            .where(Snapshot.civicapi_id == race_id)
            .order_by(desc(Snapshot.taken_at))
            .limit(limit)
        )
        rows = list(s.exec(stmt))
        return {
            "count": len(rows),
            "snapshots": [
                {
                    "taken_at": r.taken_at.isoformat(),
                    "percent_reporting": r.percent_reporting,
                    "candidates": (r.payload or {}).get("candidates"),
                }
                for r in rows
            ],
        }


@router.get("/{race_id}/history")
async def proxy_history(request: Request, race_id: str) -> dict[str, Any]:
    """Cached pass-through to civicAPI's /race/{id}/history (timestamps list)."""
    client = request.app.state.civicapi
    timestamps = await client.list_history_timestamps(race_id)
    return {"id": race_id, "count": len(timestamps), "timestamps": timestamps}
