import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { usePolling } from "../hooks";
import { STATES, fmtRel } from "../utils";

const POLL_INTERVAL_MS = 30_000;

const KINDS = [
  "", "new_race", "winner_called", "winner_uncalled",
  "new_leader", "reporting_jump", "margin_swing",
];

export default function Feed() {
  const [kind, setKind] = useState("");
  const [province, setProvince] = useState("");

  const { data, error, loading } = usePolling(
    () => api.feed({
      kind: kind || undefined,
      province: province || undefined,
      limit: 200,
    }),
    POLL_INTERVAL_MS,
    [kind, province],
  );

  return (
    <>
      <h1>Event Feed</h1>
      <p className="page-sub">
        {loading && !data ? <span className="spinner" /> : null}
        Reverse-chronological diff events.
        {data ? ` ${data.count} event${data.count === 1 ? "" : "s"}.` : ""}
      </p>

      <div className="toolbar">
        <label>
          Kind{" "}
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map((k) => <option key={k} value={k}>{k || "All"}</option>)}
          </select>
        </label>
        <label>
          State{" "}
          <select value={province} onChange={(e) => setProvince(e.target.value)}>
            <option value="">All</option>
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      {error && <div className="error">Error: {error}</div>}

      {data && data.events.length === 0 && (
        <div className="empty">
          No events yet. The poller writes events as it observes changes — give it a few minutes after first start.
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {data?.events.map((ev) => (
          <div className="feed-event" key={ev.id}>
            <span className="feed-time">{fmtRel(ev.occurred_at)}</span>
            <span className={`feed-kind ${ev.kind}`}>{ev.kind}</span>
            <div>
              <Link to={`/race/${encodeURIComponent(ev.race.id)}`} className="feed-race">
                {ev.race.election_name}
              </Link>
              <div className="feed-race-meta">
                {ev.race.office}
                {ev.race.province ? ` • ${ev.race.province}` : ""}
                {Object.keys(ev.payload || {}).length > 0 && (
                  <> • <code>{JSON.stringify(ev.payload)}</code></>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
