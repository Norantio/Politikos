"""Tiered poller — see docs/spec.md § Polling tiers.

Wired into main.py via lifespan. Uses APScheduler (asyncio).
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from datetime import date, datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlmodel import select

from ..config import settings
from ..db.models import DiffEvent, RaceCache, Snapshot
from ..db.session import session_scope
from .civicapi import CivicAPIClient, normalize_detail_race, normalize_search_race
from .differ import diff_race

logger = logging.getLogger(__name__)


def _iso_to_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def _hash_payload(payload: dict) -> str:
    """Stable hash of the parts of the payload that matter for diffing."""
    parts = {
        "percent_reporting": payload.get("percent_reporting"),
        "candidates": [
            {
                "name": c.get("name"),
                "votes": c.get("votes"),
                "percent": c.get("percent"),
                "winner": c.get("winner"),
            }
            for c in (payload.get("candidates") or [])
        ],
    }
    return hashlib.sha256(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()


async def discover_upcoming(client: CivicAPIClient, *, horizon_days: int = 30) -> int:
    """Daily sweep: insert new civicapi_ids we haven't seen and refresh metadata."""
    today = date.today()
    end = today + timedelta(days=horizon_days)
    payload = await client.search_races(
        country=settings.country_filter,
        start_date=today.isoformat(),
        end_date=end.isoformat(),
        limit=50_000,
    )
    races = payload.get("races", [])
    now = datetime.now(timezone.utc)
    inserted = 0
    with session_scope() as s:
        for raw in races:
            n = normalize_search_race(raw)
            if not n["civicapi_id"]:
                continue
            existing = s.get(RaceCache, n["civicapi_id"])
            payload_hash = _hash_payload(raw)
            if existing is None:
                s.add(
                    RaceCache(
                        civicapi_id=n["civicapi_id"],
                        country=n["country"] or "??",
                        province=n["province"],
                        district=n["district"],
                        municipality=n["municipality"],
                        election_name=n["election_name"] or "",
                        office=n["office"] or "Other",
                        scope=n["scope"],
                        election_date=_iso_to_dt(n["election_date"]) or now,
                        has_breakdown=n["has_breakdown"],
                        has_map=n["has_map"],
                        seats=n["seats"],
                        percent_reporting=n["percent_reporting"],
                        winner_names=[c["name"] for c in n["candidates"] if c.get("winner")],
                        raw_json=raw,
                        payload_hash=payload_hash,
                        fetched_at=now,
                        discovered_at=now,
                    )
                )
                inserted += 1
                s.add(
                    DiffEvent(
                        civicapi_id=n["civicapi_id"],
                        occurred_at=now,
                        kind="new_race",
                        payload={"election_name": n["election_name"]},
                    )
                )
            else:
                existing.election_name = n["election_name"] or existing.election_name
                existing.office = n["office"] or existing.office
                existing.scope = n["scope"] or existing.scope
                existing.has_breakdown = n["has_breakdown"]
                existing.has_map = n["has_map"]
                existing.seats = n["seats"] or existing.seats
                existing.fetched_at = now
    logger.info("discover_upcoming: %d new races (sweep returned %d)", inserted, len(races))
    return inserted


async def _refresh_one(client: CivicAPIClient, race_id: str) -> None:
    """Fetch /race/{id}, diff against cache, write snapshot + diff_events."""
    try:
        raw = await client.get_race(race_id)
    except Exception as exc:
        logger.warning("refresh %s failed: %s", race_id, exc)
        return

    n = normalize_detail_race(raw, race_id)
    new_hash = _hash_payload(raw)
    now = datetime.now(timezone.utc)

    with session_scope() as s:
        rc = s.get(RaceCache, race_id)
        if rc is None:
            return
        prev_payload = rc.raw_json or {}
        if rc.payload_hash == new_hash:
            rc.fetched_at = now
            return

        events = diff_race(prev_payload, raw)
        rc.raw_json = raw
        rc.payload_hash = new_hash
        rc.fetched_at = now
        rc.percent_reporting = int(raw.get("percent_reporting") or 0)
        rc.is_disputed = bool(raw.get("is_disputed"))
        rc.polls_open = _iso_to_dt(raw.get("polls_open")) or rc.polls_open
        rc.polls_close = _iso_to_dt(raw.get("polls_close")) or rc.polls_close
        rc.office = n["office"] or rc.office
        rc.scope = n["scope"] or rc.scope
        rc.winner_names = [c["name"] for c in (raw.get("candidates") or []) if c.get("winner")]

        s.add(
            Snapshot(
                civicapi_id=race_id,
                taken_at=now,
                percent_reporting=rc.percent_reporting,
                payload=raw,
                payload_hash=new_hash,
            )
        )
        for ev in events:
            s.add(
                DiffEvent(
                    civicapi_id=race_id,
                    occurred_at=now,
                    kind=ev["kind"],
                    payload=ev["payload"],
                )
            )


async def poll_tier_live(client: CivicAPIClient) -> None:
    """20s tick — refresh races on today with reporting < 100."""
    today = datetime.now(timezone.utc).date()
    start = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    with session_scope() as s:
        ids = list(
            s.exec(
                select(RaceCache.civicapi_id).where(
                    RaceCache.election_date >= start,
                    RaceCache.election_date < end,
                    RaceCache.percent_reporting < 100,
                )
            )
        )
    if not ids:
        return
    logger.debug("poll_tier_live: refreshing %d races", len(ids))
    for race_id in ids:
        await _refresh_one(client, race_id)
        await asyncio.sleep(0.05)


async def poll_tier_upcoming(client: CivicAPIClient) -> None:
    """1hr tick — refresh metadata for races within 30 days but not today."""
    now = datetime.now(timezone.utc)
    horizon = now + timedelta(days=30)
    today_start = datetime.combine(now.date(), datetime.min.time(), tzinfo=timezone.utc)
    today_end = today_start + timedelta(days=1)
    with session_scope() as s:
        ids = list(
            s.exec(
                select(RaceCache.civicapi_id).where(
                    RaceCache.election_date >= now,
                    RaceCache.election_date < horizon,
                    ~(
                        (RaceCache.election_date >= today_start)
                        & (RaceCache.election_date < today_end)
                    ),
                )
            )
        )
    logger.info("poll_tier_upcoming: refreshing %d races", len(ids))
    for race_id in ids:
        await _refresh_one(client, race_id)
        await asyncio.sleep(0.1)


def attach_scheduler(app, client: CivicAPIClient) -> AsyncIOScheduler:
    sched = AsyncIOScheduler(timezone="UTC")
    sched.add_job(
        discover_upcoming,
        "interval",
        seconds=settings.poller_historical_interval,
        kwargs={"client": client},
        next_run_time=datetime.now(timezone.utc) + timedelta(seconds=5),
        id="discover",
    )
    sched.add_job(
        poll_tier_live,
        "interval",
        seconds=settings.poller_live_interval,
        kwargs={"client": client},
        id="live",
    )
    sched.add_job(
        poll_tier_upcoming,
        "interval",
        seconds=settings.poller_upcoming_interval,
        kwargs={"client": client},
        id="upcoming",
    )
    sched.start()
    return sched
