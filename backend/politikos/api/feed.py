"""GET /api/feed, /api/calendar."""

from typing import Any

from fastapi import APIRouter, Query, Request
from sqlmodel import desc, select

from ..db.models import DiffEvent, RaceCache
from ..db.session import session_scope

router = APIRouter(tags=["feed"])


@router.get("/feed")
async def list_feed(
    kind: str | None = Query(None, description="Filter by diff kind"),
    province: str | None = Query(None, description="Filter by USPS state code"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    with session_scope() as s:
        stmt = select(DiffEvent, RaceCache).join(
            RaceCache, RaceCache.civicapi_id == DiffEvent.civicapi_id
        )
        if kind:
            stmt = stmt.where(DiffEvent.kind == kind)
        if province:
            stmt = stmt.where(RaceCache.province == province.upper())
        stmt = stmt.order_by(desc(DiffEvent.occurred_at)).offset(offset).limit(limit)
        rows = list(s.exec(stmt))
        return {
            "count": len(rows),
            "events": [
                {
                    "id": ev.id,
                    "occurred_at": ev.occurred_at.isoformat(),
                    "kind": ev.kind,
                    "payload": ev.payload,
                    "race": {
                        "id": rc.civicapi_id,
                        "election_name": rc.election_name,
                        "province": rc.province,
                        "office": rc.office,
                    },
                }
                for ev, rc in rows
            ],
        }


@router.get("/calendar")
async def calendar(
    request: Request,
    year: int | None = None,
    province: str | None = None,
) -> dict[str, Any]:
    """Wraps civicAPI getElectionDates."""
    client = request.app.state.civicapi
    return await client.election_dates(year=year, country="US", province=province)
