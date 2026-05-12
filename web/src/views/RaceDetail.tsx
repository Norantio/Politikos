import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type Race, type Candidate } from "../api";
import { fmtNum, fmtPct, fmtRel, fmtTime } from "../utils";

export default function RaceDetail() {
  const { id } = useParams<{ id: string }>();
  const [race, setRace] = useState<Race | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api.getRace(id)
      .then((r) => { if (!cancelled) setRace(r); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [id]);

  if (error) return <div className="error">Error: {error}</div>;
  if (!race) return <div className="empty"><span className="spinner" /> Loading…</div>;

  const candidates: Candidate[] = (race.raw?.candidates as Candidate[] | undefined) ?? [];
  const sorted = [...candidates].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));

  return (
    <>
      <Link to="/feed" style={{ fontSize: 12 }}>← Back</Link>
      <h1 style={{ marginTop: 8 }}>{race.election_name}</h1>
      <p className="page-sub">
        {race.office}
        {race.scope ? ` • ${race.scope}` : ""}
        {race.province ? ` • ${race.province}` : ""}
        {race.district ? ` • ${race.district}` : ""}
        {race.municipality ? ` • ${race.municipality}` : ""}
      </p>

      <div className="card">
        <div><strong>Election date:</strong> {fmtTime(race.election_date)}</div>
        <div><strong>Polls:</strong> {fmtTime(race.polls_open)} → {fmtTime(race.polls_close)}</div>
        <div><strong>Reporting:</strong> {race.percent_reporting}%</div>
        <div><strong>Last fetched:</strong> {fmtRel(race.fetched_at)}</div>
        {race.is_disputed && <div style={{ color: "var(--bad)" }}><strong>⚠ Disputed</strong></div>}
      </div>

      <div className="card">
        <h3 style={{ margin: "0 0 8px" }}>Candidates ({sorted.length})</h3>
        <div className="candidates">
          {sorted.map((c, i) => (
            <div className="cand-row" key={`${c.name}-${i}`}>
              <span className={`cand-name${c.winner ? " winner" : ""}`}>
                {c.winner ? "✓ " : ""}{c.name}
                {c.party ? ` (${c.party})` : ""}
              </span>
              <span className="cand-pct">{fmtPct(c.percent)}</span>
              <span className="cand-votes">{fmtNum(c.votes)}</span>
            </div>
          ))}
        </div>
      </div>

      <details className="card">
        <summary style={{ cursor: "pointer", color: "var(--text-dim)" }}>Raw payload</summary>
        <pre style={{ overflow: "auto", fontSize: 11, marginTop: 8 }}>
{JSON.stringify(race.raw, null, 2)}
        </pre>
      </details>
    </>
  );
}
