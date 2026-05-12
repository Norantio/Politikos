"""Diff engine — compares last-known race payload against fresh fetch.

Produces diff_event rows + Redis pubsub messages. See docs/spec.md § Diff event kinds.
"""

from typing import Any

MARGIN_SWING_THRESHOLD = 2.0   # percentage points
REPORTING_JUMP_THRESHOLD = 10  # percentage points


def diff_race(prev: dict[str, Any] | None, curr: dict[str, Any]) -> list[dict[str, Any]]:
    """Return a list of diff_event payloads { kind, payload } for this race tick."""
    events: list[dict[str, Any]] = []

    if prev is None:
        events.append({"kind": "new_race", "payload": {"election_name": curr.get("election_name")}})
        return events

    # winner flips
    prev_winners = {c["name"] for c in prev.get("candidates", []) if c.get("winner")}
    curr_winners = {c["name"] for c in curr.get("candidates", []) if c.get("winner")}
    for name in curr_winners - prev_winners:
        events.append({"kind": "winner_called", "payload": {"candidate": name}})
    for name in prev_winners - curr_winners:
        events.append({"kind": "winner_uncalled", "payload": {"candidate": name}})

    # leader change
    def _leader(p: dict[str, Any]) -> str | None:
        cs = sorted(p.get("candidates", []), key=lambda c: c.get("percent", 0), reverse=True)
        return cs[0]["name"] if cs else None

    prev_leader, curr_leader = _leader(prev), _leader(curr)
    if prev_leader and curr_leader and prev_leader != curr_leader:
        events.append({
            "kind": "new_leader",
            "payload": {"prev": prev_leader, "curr": curr_leader},
        })

    # reporting jump
    prev_pct = prev.get("percent_reporting", 0) or 0
    curr_pct = curr.get("percent_reporting", 0) or 0
    if curr_pct - prev_pct >= REPORTING_JUMP_THRESHOLD:
        events.append({
            "kind": "reporting_jump",
            "payload": {"prev": prev_pct, "curr": curr_pct},
        })

    # margin swing (top-1 minus top-2)
    def _margin(p: dict[str, Any]) -> float:
        cs = sorted(p.get("candidates", []), key=lambda c: c.get("percent", 0), reverse=True)
        if len(cs) < 2:
            return 0.0
        return float(cs[0].get("percent", 0)) - float(cs[1].get("percent", 0))

    if abs(_margin(curr) - _margin(prev)) >= MARGIN_SWING_THRESHOLD:
        events.append({
            "kind": "margin_swing",
            "payload": {"prev_margin": _margin(prev), "curr_margin": _margin(curr)},
        })

    return events
