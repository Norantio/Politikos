import { useState } from "react";
import { api, type Candidate, type Race } from "../api";
import { usePolling } from "../hooks";
import { STATES, fmtNum, fmtPct, fmtRel, todayISO } from "../utils";

const POLL_INTERVAL_MS = 20_000;

export default function Live() {
  const [province, setProvince] = useState("");
  const [office, setOffice] = useState("");
  const [date, setDate] = useState(todayISO());
  const [activeOnly, setActiveOnly] = useState(true);

  const { data, error, loading } = usePolling(
    () => api.listRaces({
      province: province || undefined,
      office: office || undefined,
      election_date: date || undefined,
      active_only: activeOnly,
      limit: 200,
    }),
    POLL_INTERVAL_MS,
    [province, office, date, activeOnly],
  );

  return (
    <>
      <h1>Live Races</h1>
      <p className="page-sub">
        {loading && !data ? <span className="spinner" /> : null}
        Auto-refreshing every {POLL_INTERVAL_MS / 1000}s.
        {data ? ` Showing ${data.count} race${data.count === 1 ? "" : "s"}.` : ""}
      </p>

      <div className="toolbar">
        <label>
          Date{" "}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          State{" "}
          <select value={province} onChange={(e) => setProvince(e.target.value)}>
            <option value="">All</option>
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>
          Office{" "}
          <input
            placeholder="e.g. Sheriff"
            value={office}
            onChange={(e) => setOffice(e.target.value)}
            style={{ width: 160 }}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />{" "}
          Active only (reporting &lt; 100%)
        </label>
      </div>

      {error && <div className="error">Error: {error}</div>}

      {data && data.races.length === 0 && (
        <div className="empty">No races match these filters yet.</div>
      )}

      {data?.races.map((r) => <RaceCard key={r.id} race={r} />)}
    </>
  );
}

function RaceCard({ race }: { race: Race }) {
  const candidates: Candidate[] = (race.raw?.candidates as Candidate[] | undefined) ?? [];
  const sorted = [...candidates].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
  const reporting = race.percent_reporting ?? 0;
  return (
    <div className="card race-card">
      <div>
        <div className="race-head">
          <span className="race-name">{race.election_name}</span>
          {race.scope === "Primary" && <span className="pill pill-primary">Primary</span>}
          {race.scope === "Statewide" && <span className="pill pill-statewide">Statewide</span>}
          {race.is_disputed && <span className="pill pill-disputed">Disputed</span>}
          {reporting >= 100 && race.winner_names.length > 0 && (
            <span className="pill pill-called">Called</span>
          )}
        </div>
        <div className="race-meta">
          {race.office}
          {race.province && <><span className="dot">•</span>{race.province}</>}
          {race.district && <><span className="dot">•</span>{race.district}</>}
          {race.municipality && <><span className="dot">•</span>{race.municipality}</>}
          <span className="dot">•</span>updated {fmtRel(race.fetched_at)}
        </div>

        {sorted.length > 0 && (
          <div className="candidates">
            {sorted.slice(0, 6).map((c, i) => (
              <div className="cand-row" key={`${c.name}-${i}`}>
                <span className={`cand-name${c.winner ? " winner" : ""}`}>
                  {c.winner ? "✓ " : ""}{c.name}
                  {c.party ? ` (${c.party})` : ""}
                </span>
                <span className="cand-pct">{fmtPct(c.percent)}</span>
                <span className="cand-votes">{fmtNum(c.votes)}</span>
              </div>
            ))}
            {sorted.length > 6 && (
              <div className="race-meta">+{sorted.length - 6} more</div>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="bar-wrap"><div className="bar" style={{ width: `${reporting}%` }} /></div>
        <div className="reporting">{reporting}% reporting</div>
      </div>
    </div>
  );
}
