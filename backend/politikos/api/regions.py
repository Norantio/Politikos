"""GET /api/regions — distinct districts/municipalities for a province."""

from typing import Any

from fastapi import APIRouter, Query
from sqlalchemy import func
from sqlmodel import select

from ..db.models import RaceCache
from ..db.session import session_scope

router = APIRouter(prefix="/regions", tags=["regions"])


@router.get("")
async def list_regions(
    province: str | None = Query(None, description="USPS state code, e.g. FL"),
) -> dict[str, Any]:
    """Return distinct districts and municipalities, with race counts."""
    with session_scope() as s:
        district_stmt = select(
            RaceCache.district, func.count(RaceCache.civicapi_id)  # type: ignore[arg-type]
        ).where(RaceCache.district.is_not(None))  # type: ignore[union-attr]
        muni_stmt = select(
            RaceCache.municipality, func.count(RaceCache.civicapi_id)  # type: ignore[arg-type]
        ).where(RaceCache.municipality.is_not(None))  # type: ignore[union-attr]
        if province:
            p = province.upper()
            district_stmt = district_stmt.where(RaceCache.province == p)
            muni_stmt = muni_stmt.where(RaceCache.province == p)
        district_stmt = district_stmt.group_by(RaceCache.district).order_by(RaceCache.district)
        muni_stmt = muni_stmt.group_by(RaceCache.municipality).order_by(RaceCache.municipality)

        districts = [
            {"name": name, "count": count}
            for name, count in s.exec(district_stmt).all()
            if name
        ]
        municipalities = [
            {"name": name, "count": count}
            for name, count in s.exec(muni_stmt).all()
            if name
        ]
        return {
            "province": province.upper() if province else None,
            "districts": districts,
            "municipalities": municipalities,
        }
