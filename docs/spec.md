# Politikos — v1 Spec

_Last revised: 2026-05-12_

## Mission

A self-hosted, real-time dashboard for U.S. elections at every level —
federal, state, county, municipal, and ballot measures — backed by
[civicAPI](https://civicapi.org).

## Design pivots (the three orthogonal axes)

1. **Geography** — federal → state → county → precinct (when available)
2. **Time** — upcoming → live → called → historical
3. **Office type** — executive / legislative / judicial / ballot measure

The interesting views are diagonals across these axes
("all sheriff races in Florida tonight", "every contested state-senate
race nationally with <5% margin", "ballot measures only sorted by
lowest reporting %"). The UI is built around filterable axes, not a
nested menu.

## v1 scope

- National + state choropleth map of all live races today
- Race-detail page: candidates, %, reporting, winner flag, margin sparkline (last 24h)
- **Replay scrubber** — full historical playback via civicAPI `/history`
- **Down-ballot mode** — filter UI on `election_scope`
- **Ballot measure tracker** — filter UI on `election_type`
- **Diff feed** — chronological timeline of call flips, big margin swings, new races
- Election calendar view (`getElectionDates`)
- Watchlist of pinned races (localStorage in v1)
- Hard-filter `country=US` in v1

## v1.5 (deferred)

- Address → "my ballot" view (Census Geocoder + TIGER → join civicAPI province/district strings)
- FEC enrichment for federal races
- OpenStates enrichment for state legislators
- Push notifications on watchlist
- Cross-race candidate aggregation (fuzzy name matching — civicAPI has no candidate IDs)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React 18 + Vite SPA (politikos-web)                        │
│  - MapLibre choropleth                                      │
│  - WS subscriber for live deltas                            │
│  - Race table / detail / replay / feed                      │
└──────────────────────────────────────────────────────────────┘
              │ REST + WebSocket
              ▼
┌─────────────────────────────────────────────────────────────┐
│  FastAPI + APScheduler (politikos-api)                      │
│  - Tiered poller against civicAPI                           │
│  - Diff engine writes diff_event rows + Redis pubsub        │
│  - WS endpoint fans out to subscribed clients               │
│  - REST: races, race detail, feed, calendar                 │
└─────────────────────────────────────────────────────────────┘
        │                       │
        ▼                       ▼
┌──────────────┐      ┌──────────────────┐
│  Postgres    │      │  Redis (pubsub)  │
│  - race_cache│      │  - chan: race:*  │
│  - diff_event│      │  - chan: feed    │
│  - snapshot  │      └──────────────────┘
└──────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  civicAPI (no auth, attribution required)                   │
│  See docs/civicapi-notes.md for the full endpoint inventory │
└─────────────────────────────────────────────────────────────┘
```

## Polling tiers

| Tier | Cadence | Set |
|------|---------|-----|
| Live | 20s | races where `election_date == today` AND `percent_reporting < 100` |
| Election-day idle | 2 min | races on today but `percent_reporting == 100` |
| Upcoming | 1 hr | races within 30 days |
| Historical | 1 / day | metadata refresh only |

One process, one APScheduler instance. Each cycle:

1. Compute the set for the tier from `race_cache`.
2. For each race, GET `/race/{id}`.
3. Hash the `candidates` + `percent_reporting` payload; if changed, write a `diff_event` and publish to `chan:race:{id}` and `chan:feed`.
4. Update `race_cache.raw_json` + `race_cache.fetched_at`.

Race discovery happens via a daily `/race/search` sweep over the next 30 days,
inserting any new `civicapi_id` into `race_cache`.

**civicAPI snapshot cadence (measured 2026-05-12):** ~1-2 minutes per snapshot
during live counting. Our 20s poll meaningfully outpaces this, so local
`snapshot` rows are justified for sub-minute analytics.

## Snapshots

We record our own `snapshot` rows every poll, even though civicAPI exposes
`/history`, because:

- Our cadence (20s) is finer than civicAPI's documented sub-minute granularity
- We survive civicAPI outages without losing local replay
- It enables sub-minute analytics later (margin velocity, swing forecasts)

For races with `percent_reporting == 100` and a winner, we stop snapshotting
and rely on civicAPI's `/history` for cold replay.

## Diff event kinds

| Kind | Trigger |
|------|---------|
| `new_race` | first time we see a `civicapi_id` |
| `winner_called` | a candidate's `winner` flag flips false→true |
| `winner_uncalled` | a candidate's `winner` flag flips true→false (rare, but possible) |
| `margin_swing` | leading margin changes by ≥ N percentage points (configurable, default 2.0) |
| `reporting_jump` | `percent_reporting` jumps by ≥ N points (configurable, default 10) |
| `new_leader` | the leading candidate changes |

## REST endpoints (politikos-api)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/healthz` | liveness |
| GET | `/api/races` | list / filter (state, election_date, election_type, election_scope, has_breakdown) |
| GET | `/api/races/{id}` | full payload (mirrors civicAPI race + our metadata) |
| GET | `/api/races/{id}/snapshots` | our local snapshot timeline |
| GET | `/api/races/{id}/history` | proxy to civicAPI `/history` (cached) |
| GET | `/api/feed` | recent diff_events (paginated, filterable) |
| GET | `/api/calendar?year=&month=` | wraps `getElectionDates` |
| WS | `/ws` | subscribe by topic: `race:{id}`, `feed`, `state:{XX}` |

## Naming / deploy

- Containers: `politikos-api`, `politikos-web`, `politikos-postgres`, `politikos-redis`
- Compose project: `politikos`
- On Jetson: joins `flotilla` external network; nginx proxies `/apps/politikos/` → `politikos-web`, `/apps/politikos/api/` → `politikos-api`
- Behind Authelia for auth (consistent with other Flotilla apps)

## Open questions

- What does civicAPI's `election_type` actually contain? ("primary", "general", "ballot_measure", "referendum"?) — needs a live probe before we hardcode UI filter values
- What's civicAPI's snapshot cadence? Affects whether our 20s poll meaningfully outpaces it
- Are there undocumented rate limits? — be polite, retry with exponential backoff, monitor for 429s
