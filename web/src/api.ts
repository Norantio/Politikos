// Tiny fetch wrapper. Default base = `${BASE_URL}api` so it works whether
// the app is served from "/" or "/apps/politikos/" (Flotilla gateway).
// In dev (vite), set VITE_API_BASE=http://localhost:8090/api to bypass.

const BASE = (import.meta.env.VITE_API_BASE as string | undefined)
  ?? ((import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/api");

async function get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(BASE + path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "" && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

export interface Candidate {
  name: string;
  votes?: number;
  percent?: number;
  party?: string;
  winner?: boolean;
}

export interface Race {
  id: string;
  country: string;
  province: string | null;
  district: string | null;
  municipality: string | null;
  election_name: string;
  office: string;
  scope: string | null;
  election_date: string | null;
  polls_open: string | null;
  polls_close: string | null;
  has_breakdown: boolean;
  has_map: boolean;
  seats: number | null;
  percent_reporting: number;
  winner_names: string[];
  is_disputed: boolean;
  fetched_at: string | null;
  raw?: { candidates?: Candidate[]; [k: string]: unknown };
}

export interface FeedEvent {
  id: number;
  occurred_at: string;
  kind: string;
  payload: Record<string, unknown>;
  race: { id: string; election_name: string; province: string | null; office: string };
}

export interface RacesResponse { count: number; races: Race[]; }
export interface FeedResponse { count: number; events: FeedEvent[]; }
export interface CalendarEntry { date: string; count?: number }
export interface CalendarResponse {
  // civicAPI shape varies; keep loose typing
  dates?: CalendarEntry[];
  [k: string]: unknown;
}
export interface RegionEntry { name: string; count: number }
export interface RegionsResponse {
  province: string | null;
  districts: RegionEntry[];
  municipalities: RegionEntry[];
}

export const api = {
  listRaces: (q: { province?: string; district?: string; municipality?: string; q?: string; office?: string; scope?: string; election_date?: string; active_only?: boolean; limit?: number; offset?: number } = {}) =>
    get<RacesResponse>("/races", q),
  getRace: (id: string) => get<Race>(`/races/${encodeURIComponent(id)}`),
  feed: (q: { kind?: string; province?: string; limit?: number; offset?: number } = {}) =>
    get<FeedResponse>("/feed", q),
  calendar: (q: { year?: number; province?: string } = {}) =>
    get<CalendarResponse>("/calendar", q),
  regions: (q: { province?: string } = {}) =>
    get<RegionsResponse>("/regions", q),
};
