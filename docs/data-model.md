# Data Model

Postgres 16. SQLModel via the FastAPI backend.

## Tables

### `race_cache`

The single row of truth per upstream race. Updated every poll.

| column | type | notes |
|--------|------|-------|
| `civicapi_id` | text PK | upstream race id |
| `country` | text | ISO 3166-1 |
| `province` | text NULL | ISO 3166-2 short |
| `district` | text NULL | English name |
| `municipality` | text NULL | |
| `election_name` | text | |
| `office` | text | from search.`type` / detail.`election_type` (e.g. "Governor", "Sheriff") |
| `scope` | text | from search.`election_type` / detail.`election_scope` (`Primary` \| `Statewide` \| ...) |
| `election_date` | timestamptz | UTC; civicAPI normalizes to 05:00 UTC |
| `polls_open` | timestamptz NULL | |
| `polls_close` | timestamptz NULL | |
| `has_breakdown` | bool | |
| `has_map` | bool | |
| `seats` | int NULL | |
| `percent_reporting` | int | 0..100 |
| `winner_names` | text[] | denormalized for fast list queries |
| `is_disputed` | bool | |
| `raw_json` | jsonb | last full payload from civicAPI |
| `payload_hash` | text | sha256 of normalized payload — used to detect change |
| `fetched_at` | timestamptz | last poll |
| `discovered_at` | timestamptz | first time we saw this race |

Indexes: `(country, province)`, `(election_date)`, `(office)`, `(scope)`,
partial `(election_date) WHERE percent_reporting < 100`.

### `snapshot`

Time series of every payload we observed.

| column | type | notes |
|--------|------|-------|
| `id` | bigserial PK | |
| `civicapi_id` | text FK → race_cache | |
| `taken_at` | timestamptz | |
| `percent_reporting` | int | denormalized for sparklines |
| `payload` | jsonb | full race detail |
| `payload_hash` | text | unique with `civicapi_id` to dedupe identical polls |

Indexes: `(civicapi_id, taken_at DESC)`. Optional TimescaleDB hypertable on `taken_at` if/when volume warrants.

### `diff_event`

The diff feed.

| column | type | notes |
|--------|------|-------|
| `id` | bigserial PK | |
| `civicapi_id` | text FK → race_cache | |
| `occurred_at` | timestamptz | |
| `kind` | text | `new_race` \| `winner_called` \| `winner_uncalled` \| `new_leader` \| `margin_swing` \| `reporting_jump` |
| `payload` | jsonb | kind-specific (e.g. `{ candidate, party, prev_pct, new_pct }`) |

Indexes: `(occurred_at DESC)`, `(civicapi_id, occurred_at DESC)`, `(kind, occurred_at DESC)`.

### `watchlist` (v1.5)

Per-user pinned races. v1 stores in browser localStorage; v1.5 promotes to server.

| column | type | notes |
|--------|------|-------|
| `user_id` | text | from Authelia header |
| `civicapi_id` | text FK → race_cache | |
| `pinned_at` | timestamptz | |

PK: `(user_id, civicapi_id)`.

## What we deliberately do not store

- **Candidate master records.** civicAPI has no candidate IDs; any local table would just be a fuzzy join surface, not source of truth.
- **Jurisdiction master records.** civicAPI's `province`/`district`/`municipality` strings *are* our jurisdiction key. v1.5 ballot lookup will introduce a TIGER-derived join table separately.
- **Calls / callers.** civicAPI exposes no caller metadata; we derive call events from `winner` boolean flips and store them only as `diff_event` rows.
