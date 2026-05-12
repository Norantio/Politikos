import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { STATE_NAME_TO_ABBR, STATES } from "../utils";

// us-atlas states topojson (counties topojson loaded by StateView).
const US_STATES_TOPOJSON = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

export default function USMap() {
  const navigate = useNavigate();
  const [hover, setHover] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const matches = search
    ? STATES.filter((s) => s.toLowerCase().includes(search.toLowerCase())
        || (Object.entries(STATE_NAME_TO_ABBR).find(([name]) =>
              name.toLowerCase().startsWith(search.toLowerCase()))?.[1] === s))
    : [];

  return (
    <>
      <h1>Browse by State</h1>
      <p className="page-sub">
        Click a state on the map to drill into its counties and races.
      </p>

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search states (e.g. Florida or FL)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280 }}
        />
        {matches.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {matches.slice(0, 10).map((abbr) => (
              <button
                key={abbr}
                className="pill pill-statewide"
                style={{ cursor: "pointer", border: 0 }}
                onClick={() => navigate(`/state/${abbr}`)}
              >
                {abbr}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="map-wrap">
        <ComposableMap projection="geoAlbersUsa" width={980} height={560} style={{ width: "100%", height: "auto" }}>
          <Geographies geography={US_STATES_TOPOJSON}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const name = geo.properties.name as string;
                const abbr = STATE_NAME_TO_ABBR[name];
                const isHover = hover === name;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={() => setHover(name)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => abbr && navigate(`/state/${abbr}`)}
                    style={{
                      default: {
                        fill: isHover ? "#f5a142" : "#1a2440",
                        stroke: "#243054",
                        strokeWidth: 0.6,
                        outline: "none",
                        cursor: abbr ? "pointer" : "default",
                      },
                      hover: {
                        fill: "#f5a142",
                        stroke: "#f5a142",
                        strokeWidth: 0.8,
                        outline: "none",
                        cursor: abbr ? "pointer" : "default",
                      },
                      pressed: {
                        fill: "#4cc9f0",
                        outline: "none",
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
        <div className="map-tooltip">{hover ?? "Hover a state"}</div>
      </div>
    </>
  );
}
