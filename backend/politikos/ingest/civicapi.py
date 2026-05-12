"""Typed civicAPI v2 client.

Endpoint inventory + reality-vs-docs notes: see docs/civicapi-notes.md.

Field-name mismatch — the client returns RAW upstream payloads. Caller is
responsible for normalizing search.`type` ↔ detail.`election_type` into our
internal `office` field.
"""

from typing import Any

import httpx

from ..config import settings


class CivicAPIClient:
    def __init__(self, base_url: str | None = None, user_agent: str | None = None) -> None:
        self._base = (base_url or settings.civicapi_base_url).rstrip("/")
        self._headers = {"User-Agent": user_agent or settings.civicapi_user_agent}
        self._client = httpx.AsyncClient(base_url=self._base, headers=self._headers, timeout=30.0)

    async def aclose(self) -> None:
        await self._client.aclose()

    # --- /status ---------------------------------------------------------
    async def status(self) -> dict[str, Any]:
        r = await self._client.get("/status")
        r.raise_for_status()
        return r.json()

    # --- /race/search ----------------------------------------------------
    async def search_races(
        self,
        *,
        start_date: str | None = None,
        end_date: str | None = None,
        query: str | None = None,
        country: str | None = None,
        province: str | None = None,
        district: str | None = None,
        election_type: str | None = None,
        limit: int = 50_000,
    ) -> dict[str, Any]:
        params = {
            "startDate": start_date,
            "endDate": end_date,
            "query": query,
            "country": country,
            "province": province,
            "district": district,
            "election_type": election_type,
            "limit": limit,
        }
        params = {k: v for k, v in params.items() if v is not None}
        r = await self._client.get("/race/search", params=params)
        r.raise_for_status()
        return r.json()

    # --- /race/{id} ------------------------------------------------------
    async def get_race(self, race_id: str, *, precinct: bool = False) -> dict[str, Any]:
        params: dict[str, Any] = {}
        if precinct:
            params["precinct"] = ""
        r = await self._client.get(f"/race/{race_id}", params=params)
        r.raise_for_status()
        return r.json()

    # --- /race/{id}/history ---------------------------------------------
    async def list_history_timestamps(self, race_id: str) -> list[str]:
        """Returns a flat list of ISO timestamp strings, newest-first.

        civicAPI's actual response is `{ id, count, timestamps: ["...", "..."] }`
        even though the docs claim `timestamps: [{ timestamp: "..." }, ...]`.
        Returns an empty list if civicAPI responds with `no history found`.
        """
        try:
            r = await self._client.get(f"/race/{race_id}/history")
            r.raise_for_status()
        except httpx.HTTPStatusError:
            return []
        data = r.json()
        if not isinstance(data, dict) or "timestamps" not in data:
            return []
        ts = data.get("timestamps") or []
        if ts and isinstance(ts[0], dict):
            return [t.get("timestamp") for t in ts if isinstance(t, dict) and t.get("timestamp")]
        return [t for t in ts if isinstance(t, str)]

    async def get_history_snapshot(
        self, race_id: str, timestamp: str, *, light: bool = True
    ) -> dict[str, Any]:
        params: dict[str, Any] = {}
        if light:
            params["light"] = ""
        r = await self._client.get(f"/race/{race_id}/history/{timestamp}", params=params)
        r.raise_for_status()
        return r.json()

    # --- /getElectionDates ----------------------------------------------
    async def election_dates(
        self,
        *,
        year: int | None = None,
        country: str | None = None,
        province: str | None = None,
    ) -> dict[str, Any]:
        params = {"year": year, "country": country, "province": province}
        params = {k: v for k, v in params.items() if v is not None}
        r = await self._client.get("/getElectionDates", params=params)
        r.raise_for_status()
        return r.json()

    # --- /getElectionYears ----------------------------------------------
    async def election_years(self) -> dict[str, Any]:
        r = await self._client.get("/getElectionYears")
        r.raise_for_status()
        return r.json()


# ─── Normalizers ───────────────────────────────────────────────────
# civicAPI uses different field names on /search vs /{id}. Our internal model
# uses `office` and `scope` consistently.

def normalize_search_race(raw: dict[str, Any]) -> dict[str, Any]:
    """Project a /race/search row into our normalized shape."""
    return {
        "civicapi_id": str(raw.get("id")),
        "country": raw.get("country"),
        "province": raw.get("province"),
        "district": raw.get("district"),
        "municipality": raw.get("municipality"),
        "election_name": raw.get("election_name"),
        "office": raw.get("type"),
        "scope": raw.get("election_type"),
        "election_date": raw.get("election_date"),
        "has_breakdown": bool(raw.get("has_breakdown")),
        "has_map": bool(raw.get("has_map")),
        "seats": raw.get("seats"),
        "percent_reporting": int(raw.get("percent_reporting") or 0),
        "candidates": raw.get("candidates", []),
    }


def normalize_detail_race(raw: dict[str, Any], civicapi_id: str) -> dict[str, Any]:
    """Project a /race/{id} body into our normalized shape."""
    return {
        "civicapi_id": civicapi_id,
        "country": raw.get("country"),
        "province": raw.get("province"),
        "district": raw.get("district"),
        "municipality": raw.get("municipality"),
        "election_name": raw.get("election_name"),
        "office": raw.get("election_type"),
        "scope": raw.get("election_scope"),
        "election_date": raw.get("election_date"),
        "polls_open": raw.get("polls_open"),
        "polls_close": raw.get("polls_close"),
        "is_disputed": bool(raw.get("is_disputed")),
        "candidates": raw.get("candidates", []),
        "region_results": raw.get("region_results", []),
    }
