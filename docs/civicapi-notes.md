# civicAPI v2 — Endpoint Inventory

_Captured 2026-05-12 from <https://civicapi.org/api-documentation>._

Base URL: `https://civicapi.org/api/v2/`
**Auth:** none required. **Attribution:** required for non-personal use.
**Rate limits:** not documented. Be polite.

## Endpoints

### `GET /status`
Health check. Returns `{ "status": "ok" }`.

---

### `GET /race/search`

Query params (all optional):

| Param | Type | Notes |
|-------|------|-------|
| `startDate` | date `YYYY-MM-DD` | races on/after this date |
| `endDate` | date `YYYY-MM-DD` | races on/before this date |
| `query` | string | name search; slow — prefer structured filters |
| `country` | string | ISO 3166-1 alpha-2 (`US`) — alpha-3 (`USA`) for limited-recognition / abolished |
| `province` | string | ISO 3166-2 (`AL`, `JP-07`) |
| `district` | string | full English name (e.g. county) |
| `election_type` | string | (values not enumerated in docs — needs live probe) |
| `limit` | integer | default 20, max 50,000 |

Response shape:

```json
{
  "count": 123,
  "races": [
    {
      "id": 12345,
      "type": "...",
      "country": "US",
      "province": "FL",
      "district": "Miami-Dade",
      "municipality": null,
      "election_name": "...",
      "election_type": "...",
      "election_date": "2026-11-03T05:00:00Z",
      "has_breakdown": 1,
      "has_map": 1,
      "seats": 1,
      "percent_reporting": 100,
      "candidates": [
        {
          "name": "...", "party": "...", "color": "#hex",
          "votes": 0, "percent": 0, "winner": false,
          "seats": 0, "electoral_votes": 0, "delegates": 0,
          "legislative_votes": 0
        }
      ]
    }
  ],
  "region_results": [
    {
      "region": { "name": "...", "type": "...", "fill": "#hex", "percent_reporting": 0 },
      "candidates": [
        { "name": "...", "party": "...", "incumbent": false,
          "major_candidate": true, "winner": false, "color": "#hex",
          "votes": "0", "percent": "0", "percent_reporting": 0 }
      ]
    }
  ]
}
```

Note: `election_date` is **always UTC normalized to 5:00 AM** regardless of the
region's timezone. Don't display it raw.

---

### `GET /race/{raceid}`

Path param: `raceid` (string, required).

Optional flags:

- `?generateMap` — returns SVG. `&format=percentage` or `&format=raw` modify color/coding.
- `?generateMapPNG` — same as above but PNG.
- `?testdata` — random fake data (combinable with map flags).
- `?data=csv` — OpenElections-compatible CSV.
- `?embed` — returns `{ election_name, id, iframe }` for embedding.
- `?precinct` — include precinct rows in `region_results` (large; excluded by default).

Response (top-level, JSON mode):

```
election_name, election_type, election_scope, election_date (UTC),
country, province, district, municipality,
polls_open (UTC), polls_close (UTC),
is_disputed, registered_voters, last_updated (UTC),
round (deprecated),
candidates: [ { name, party, incumbent, major_candidate, winner, color,
                votes, percent, electoral_votes?, seats?, delegates?,
                legislative_votes?, fusion_votes? { (party): votes } } ],
region_results: [ ... same as in search ... ]
```

`election_scope` appears here but **not** in `/race/search` payloads — useful for
down-ballot filtering at the detail level.

---

### `GET /race/{raceid}/history`

Returns available snapshot timestamps:

```json
{
  "id": 12345,
  "count": 47,
  "timestamps": [
    { "timestamp": "2026-05-12T13:01:20.878Z" },
    ...
  ]
}
```

⚠️ History is **only available for races tracked after October 9, 2025**.

### `GET /race/{raceid}/history/{timestamp}`

Returns the full race JSON (same shape as `/race/{id}`) at that point in time.

Optional flags: `?generateMap`, `?generateMapPNG`, `?light` (drops `region_results`),
`?precinct`.

---

### `GET /getElectionDates?year=&country=&province=`

| Param | Notes |
|-------|-------|
| `year` | integer YYYY; defaults to current year (2026) |
| `country` | ISO 3166-1 alpha-2 / alpha-3 |
| `province` | ISO 3166-2 |

Response:

```json
{
  "year": 2026,
  "total_unique_dates": 42,
  "months": [
    {
      "month": "August",
      "month_num": 8,
      "dates": [
        {
          "day": 12,
          "date": "2026-08-12",
          "slug": "august-12",
          "count": 17
        }
      ]
    }
  ]
}
```

---

### `GET /getElectionYears`

Returns a list of every year for which civicAPI has data.

```json
{ "1788": 1, "1789": 1, ..., "2026": 1 }
```

(Year as key, integer count as value — exact shape per docs is "(year): integer required".)
No filtering options yet.

---

## Schema gaps to remember

1. **No candidate IDs.** Candidates are inlined per race; cross-race aggregation requires fuzzy name matching.
2. **No "call" record.** Winner is a boolean on candidates — no caller, no call timestamp. Derive call events by watching the flag flip.
3. **No precinct geometry.** civicAPI gives precinct *names* in `region_results` when `?precinct` is set, but no shapes. Layering on a map requires our own TIGER data.
4. **No `election_type` enumeration in docs.** Values must be discovered from live data before we can build UI filters confidently.
5. **`election_scope` only on detail endpoint, not search.** Means we can't filter the search by scope; we'd need to GET each detail or maintain our own scope cache.

## Reality vs. docs (verified 2026-05-12 with live probes)

The published docs disagree with the actual responses on several points. **Trust this section over the docs.**

### Field-name mismatch between `/race/search` and `/race/{id}`

The two endpoints rename the same underlying data:

| Concept | `/race/search` field | `/race/{id}` field |
|---|---|---|
| Office (e.g. "Governor", "School Board", "Judge") | `type` | `election_type` |
| Scope (e.g. "Statewide", "Primary") | `election_type` | `election_scope` |

This means: when filtering for sheriff/DA/judge races, you filter `type` on search
results but `election_type` on detail responses. Politikos normalizes both into
`office` and `scope` internally.

### Distinct values observed (US, 2025-2026, n=2000)

- **`election_type` (search) / `election_scope` (detail):** `Primary`, `Statewide`. Two values.
- **`type` (search) / `election_type` (detail):** 50+ values, including
  `State House`, `School Board`, `County Commissioner`, `Judge`, `State Senate`,
  `Party Committee`, `House of Representatives`, `Solicitor`, `Referendum`,
  `District Attorney`, `Township Trustee`, `Governor`, `Senate`, `Court of Appeals`,
  `Mayor`, `Sheriff`, `Attorney General`, `Supreme Court`, `Lieutenant Governor`,
  `Secretary of State`, `Other`, `Local`, etc.

### Other discrepancies

- **`province` is bare USPS** (`TX`, `FL`), not full ISO 3166-2 (`US-TX`).
- **`has_breakdown` and `has_map` are booleans**, not integers as the docs claim.
- **`timestamps` is a flat array of strings** (`["2025-11-05T05:33:31.252Z", ...]`),
  not an array of `{timestamp: "..."}` objects. Newest-first.
- **History cadence** during live counting is ~1-2 minutes per snapshot.
  Late "corrective" entries can appear weeks later (race 6921 had a 2026-01-25 entry
  for a 2025-11-05 election).
- **`registered_voters` is often `null`.**
- **`round` is deprecated** but still present (always `1` in our sample).

### Volume estimate

`getElectionDates?country=US&year=2026` reports e.g. 6,541 races on a single
municipal day (2026-05-05). Plan for 50k-100k US races/year. The default `/search`
limit of 20 is useless for our discovery sweep — always pass `limit=50000`.

## Discovery TODOs (still open)

- [ ] Find a 2026 race that already has `winner=true` to confirm how civicAPI exposes "called" state versus "all votes counted"
- [ ] Hit `?embed` to see iframe shape
- [ ] Hit `?data=csv` to see OpenElections column layout
- [ ] Hit `?generateMapPNG` and store one to see size + dimensions
