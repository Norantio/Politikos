import { useEffect, useState } from "react";
import { api } from "../api";
import { STATES } from "../utils";

export default function Calendar() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [province, setProvince] = useState("");
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.calendar({ year, province: province || undefined })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year, province]);

  // civicAPI's getElectionDates response shape isn't strictly documented;
  // best-effort: look for an array of date strings, with optional counts.
  const entries = extractDates(data);

  return (
    <>
      <h1>Election Calendar</h1>
      <p className="page-sub">
        {loading ? <span className="spinner" /> : null}
        Upcoming and historical election dates from civicAPI.
      </p>

      <div className="toolbar">
        <label>
          Year{" "}
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))}>
            {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
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

      {entries.length === 0 && !loading && (
        <div className="empty">
          No election dates returned for {year}{province ? ` / ${province}` : ""}.
        </div>
      )}

      <div className="cal-grid">
        {entries.map((e) => (
          <div className="cal-item" key={`${e.date}-${e.count ?? ""}`}>
            <div className="cal-date">{formatDate(e.date)}</div>
            <div className="cal-count">
              {e.count != null ? `${e.count} race${e.count === 1 ? "" : "s"}` : "—"}
            </div>
          </div>
        ))}
      </div>

      {data != null && entries.length === 0 && (
        <details style={{ marginTop: 24 }}>
          <summary style={{ color: "var(--text-dim)", cursor: "pointer" }}>Raw response</summary>
          <pre style={{ background: "var(--bg-elev)", padding: 12, borderRadius: 6, overflow: "auto", fontSize: 12 }}>
{JSON.stringify(data, null, 2)}
          </pre>
        </details>
      )}
    </>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
    });
  } catch { return iso; }
}

interface DateEntry { date: string; count?: number }

function extractDates(payload: unknown): DateEntry[] {
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  // Common candidate keys
  for (const key of ["dates", "election_dates", "elections", "results"]) {
    const v = obj[key];
    if (Array.isArray(v)) {
      return v.map((item) => {
        if (typeof item === "string") return { date: item };
        if (item && typeof item === "object") {
          const i = item as Record<string, unknown>;
          const date =
            (typeof i.date === "string" && i.date) ||
            (typeof i.election_date === "string" && i.election_date) ||
            (typeof i.day === "string" && i.day) ||
            "";
          const count =
            (typeof i.count === "number" && i.count) ||
            (typeof i.race_count === "number" && i.race_count) ||
            undefined;
          return { date, count };
        }
        return { date: "" };
      }).filter((e) => e.date);
    }
  }
  return [];
}
