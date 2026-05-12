import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { api, type Race, type RegionEntry } from "../api";
import { STATE_FIPS, STATE_NAMES, STATES } from "../utils";
import RaceRow from "../components/RaceRow";

// us-atlas counties topojson; we filter to one state's counties by FIPS prefix.
const US_COUNTIES_TOPOJSON = "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json";

export default function StateView() {
  const { abbr: rawAbbr = "" } = useParams<{ abbr: string }>();
  const abbr = rawAbbr.toUpperCase();
  const isValid = STATES.includes(abbr);
  const stateName = STATE_NAMES[abbr] ?? abbr;
  const fips = STATE_FIPS[abbr] ?? "";

  const [districts, setDistricts] = useState<RegionEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [races, setRaces] = useState<Race[]>([]);
  const [hover, setHover] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingRaces, setLoadingRaces] = useState(false);

  // Load distinct districts (counties) known to the API.
  useEffect(() => {
    if (!isValid) return;
    let cancelled = false;
    api.regions({ province: abbr })
      .then((d) => { if (!cancelled) setDistricts(d.districts); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [abbr, isValid]);

  // Load races for the state (filtered by selected county if any, plus search).
  useEffect(() => {
    if (!isValid) return;
    let cancelled = false;
    setLoadingRaces(true);
    api.listRaces({
      province: abbr,
      district: selected ?? undefined,
      q: search || undefined,
      limit: 300,
    })
      .then((r) => { if (!cancelled) { setRaces(r.races); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoadingRaces(false); });
    return () => { cancelled = true; };
  }, [abbr, selected, search, isValid]);

  const districtSet = useMemo(
    () => new Set(districts.map((d) => d.name.toLowerCase())),
    [districts]
  );
  const filteredDistricts = useMemo(() => {
    if (!search) return districts;
    const q = search.toLowerCase();
    return districts.filter((d) => d.name.toLowerCase().includes(q));
  }, [districts, search]);

  if (!isValid) {
    return (
      <>
        <h1>Unknown state</h1>
        <p className="page-sub">"{rawAbbr}" isn't a recognized USPS code.</p>
        <p><Link to="/map">← Back to US map</Link></p>
      </>
    );
  }

  return (
    <>
      <p style={{ fontSize: 12, marginBottom: 4 }}>
        <Link to="/map">← US map</Link>
      </p>
      <h1>{stateName} <span style={{ color: "var(--text-dim)", fontWeight: 400, fontSize: 16 }}>({abbr})</span></h1>
      <p className="page-sub">
        {districts.length} known {districts.length === 1 ? "county/district" : "counties/districts"} with race data.
        {selected && (
          <>
            {" • Filter: "}<strong>{selected}</strong>
            <button
              onClick={() => setSelected(null)}
              style={{ marginLeft: 8, background: "none", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "2px 8px", borderRadius: 4, cursor: "pointer" }}
            >Clear</button>
          </>
        )}
      </p>

      <div className="state-grid">
        {/* LEFT: County map */}
        <div>
          <div className="map-wrap">
            <ComposableMap
              projection="geoAlbersUsa"
              width={520}
              height={420}
              style={{ width: "100%", height: "auto" }}
            >
              <Geographies geography={US_COUNTIES_TOPOJSON}>
                {({ geographies }) => {
                  const stateCounties = geographies.filter(
                    (g) => String(g.id).startsWith(fips),
                  );
                  return stateCounties.map((geo) => {
                    const name = (geo.properties.name as string) ?? "";
                    const hasData = districtSet.has(name.toLowerCase())
                      || districtSet.has(`${name} county`.toLowerCase());
                    const isSelected = selected && selected.toLowerCase() === name.toLowerCase();
                    const isHover = hover === name;
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onMouseEnter={() => setHover(name)}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => setSelected(name === selected ? null : name)}
                        style={{
                          default: {
                            fill: isSelected ? "#4cc9f0" : isHover ? "#f5a142" : hasData ? "#2a3760" : "#1a2440",
                            stroke: "#243054",
                            strokeWidth: 0.4,
                            outline: "none",
                            cursor: "pointer",
                          },
                          hover: {
                            fill: isSelected ? "#4cc9f0" : "#f5a142",
                            stroke: "#f5a142",
                            strokeWidth: 0.6,
                            outline: "none",
                            cursor: "pointer",
                          },
                          pressed: { fill: "#4cc9f0", outline: "none" },
                        }}
                      />
                    );
                  });
                }}
              </Geographies>
            </ComposableMap>
            <div className="map-tooltip">{hover ?? "Hover a county"}</div>
          </div>
        </div>

        {/* RIGHT: Search + county list */}
        <div>
          <input
            type="text"
            placeholder="Search counties or races…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />
          <div className="county-list">
            {filteredDistricts.length === 0 && (
              <div className="empty" style={{ padding: 16 }}>No counties with race data yet.</div>
            )}
            {filteredDistricts.map((d) => (
              <button
                key={d.name}
                className={`county-item ${selected === d.name ? "active" : ""}`}
                onClick={() => setSelected(d.name === selected ? null : d.name)}
              >
                <span>{d.name}</span>
                <span className="county-count">{d.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <h2 style={{ marginTop: 24, marginBottom: 8, fontSize: 16 }}>
        Races
        <span style={{ color: "var(--text-dim)", fontWeight: 400, marginLeft: 8 }}>
          {loadingRaces && <span className="spinner" />}
          {races.length} result{races.length === 1 ? "" : "s"}
        </span>
      </h2>
      {error && <div className="error">Error: {error}</div>}
      {!loadingRaces && races.length === 0 && (
        <div className="empty">
          No races match. Try clearing the county filter or search box.
        </div>
      )}
      {races.map((r) => <RaceRow key={r.id} race={r} />)}
    </>
  );
}
