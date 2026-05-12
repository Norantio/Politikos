import type { Race, Candidate } from "../api";
import { fmtNum, fmtPct, fmtRel } from "../utils";

/** Compact race row used in lists (state/county pages). */
export default function RaceRow({ race }: { race: Race }) {
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
          {race.district && <><span className="dot">•</span>{race.district}</>}
          {race.municipality && <><span className="dot">•</span>{race.municipality}</>}
          <span className="dot">•</span>updated {fmtRel(race.fetched_at)}
        </div>
        {sorted.length > 0 && (
          <div className="candidates">
            {sorted.slice(0, 4).map((c, i) => (
              <div className="cand-row" key={`${c.name}-${i}`}>
                <span className={`cand-name${c.winner ? " winner" : ""}`}>
                  {c.winner ? "✓ " : ""}{c.name}{c.party ? ` (${c.party})` : ""}
                </span>
                <span className="cand-pct">{fmtPct(c.percent)}</span>
                <span className="cand-votes">{fmtNum(c.votes)}</span>
              </div>
            ))}
            {sorted.length > 4 && <div className="race-meta">+{sorted.length - 4} more</div>}
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
