"use client";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";

const API = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000" });

interface MapPoint {
  id: number;
  lat: number;
  lon: number;
  [key: string]: any;
}

interface Props {
  observations?: any[];
}

export default function OceanMap({ observations }: Props) {
  const [speciesPoints, setSpeciesPoints] = useState<MapPoint[]>([]);
  const [oceanPoints, setOceanPoints] = useState<MapPoint[]>([]);
  const [fishPoints, setFishPoints] = useState<MapPoint[]>([]);
  const [activeLayer, setActiveLayer] = useState<"species" | "ocean" | "fisheries">("species");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ species: 0, ocean: 0, fisheries: 0 });

  useEffect(() => {
    Promise.all([
      API.get("/map/species"),
      API.get("/map/oceanography"),
      API.get("/map/fisheries"),
    ]).then(([s, o, f]) => {
      const sp = (s.data.points || []).filter((p: any) => p.lat && p.lon);
      const op = (o.data.points || []).filter((p: any) => p.lat && p.lon);
      const fp = (f.data.points || []).filter((p: any) => p.lat && p.lon);
      setSpeciesPoints(sp);
      setOceanPoints(op);
      setFishPoints(fp);
      setStats({ species: sp.length, ocean: op.length, fisheries: fp.length });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const getCenter = (): [number, number] => {
    const all = [...speciesPoints, ...oceanPoints, ...fishPoints];
    if (all.length === 0) return [20, 0];
    const avgLat = all.reduce((s, p) => s + p.lat, 0) / all.length;
    const avgLon = all.reduce((s, p) => s + p.lon, 0) / all.length;
    return [avgLat, avgLon];
  };

  const getTempColor = (temp: number | null): string => {
    if (!temp) return "#888";
    if (temp < 12) return "#3b82f6";
    if (temp < 16) return "#06b6d4";
    if (temp < 20) return "#10b981";
    if (temp < 24) return "#f59e0b";
    return "#ef4444";
  };

  const getCpueColor = (catch_kg: number | null, effort: number | null): string => {
    if (!catch_kg || !effort) return "#888";
    const cpue = catch_kg / effort;
    if (cpue < 30) return "#ef4444";
    if (cpue < 100) return "#f59e0b";
    return "#10b981";
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>

      {/* Layer controls */}
      <div style={{
        display: "flex", gap: "8px", padding: "10px 12px",
        background: "#111827", borderBottom: "1px solid #1f2937",
        flexWrap: "wrap", alignItems: "center"
      }}>
        {[
          { id: "species", label: `Species (${stats.species})`, color: "#2dd4bf" },
          { id: "ocean", label: `Oceanography (${stats.ocean})`, color: "#60a5fa" },
          { id: "fisheries", label: `Fisheries (${stats.fisheries})`, color: "#a78bfa" },
        ].map(layer => (
          <button
            key={layer.id}
            onClick={() => setActiveLayer(layer.id as any)}
            style={{
              padding: "4px 12px", borderRadius: "20px", fontSize: "12px",
              cursor: "pointer", border: `1px solid ${layer.color}`,
              background: activeLayer === layer.id ? layer.color : "transparent",
              color: activeLayer === layer.id ? "#000" : layer.color,
              fontWeight: activeLayer === layer.id ? "600" : "400",
            }}
          >
            {layer.label}
          </button>
        ))}

        {/* Legend */}
        <div style={{ marginLeft: "auto", display: "flex", gap: "12px", alignItems: "center" }}>
          {activeLayer === "ocean" && (
            <>
              <span style={{ fontSize: "11px", color: "#6b7280" }}>Temperature:</span>
              {[["#3b82f6", "<12°C"], ["#06b6d4", "12-16°C"], ["#10b981", "16-20°C"], ["#f59e0b", "20-24°C"], ["#ef4444", ">24°C"]].map(([c, l]) => (
                <span key={l} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#9ca3af" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: c as string, display: "inline-block" }} />
                  {l}
                </span>
              ))}
            </>
          )}
          {activeLayer === "fisheries" && (
            <>
              <span style={{ fontSize: "11px", color: "#6b7280" }}>CPUE:</span>
              {[["#ef4444", "Low (overfished)"], ["#f59e0b", "Moderate"], ["#10b981", "Healthy"]].map(([c, l]) => (
                <span key={l} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#9ca3af" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: c as string, display: "inline-block" }} />
                  {l}
                </span>
              ))}
            </>
          )}
          {activeLayer === "species" && (
            <>
              <span style={{ fontSize: "11px", color: "#6b7280" }}>Depth:</span>
              {[["#2dd4bf", "Surface"], ["#f97316", "Deep (>200m)"]].map(([c, l]) => (
                <span key={l} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#9ca3af" }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: c as string, display: "inline-block" }} />
                  {l}
                </span>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1 }}>
        {loading ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a1628", color: "#6b7280" }}>
            Loading map data...
          </div>
        ) : (
          <MapContainer
            center={getCenter()}
            zoom={speciesPoints.length > 0 ? 6 : 2}
            style={{ height: "100%", width: "100%", background: "#0a1628" }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />

            {/* Species layer */}
            {activeLayer === "species" && speciesPoints.map(p => (
              <CircleMarker
                key={`s-${p.id}`}
                center={[p.lat, p.lon]}
                radius={p.depth_m && p.depth_m > 200 ? 7 : 5}
                pathOptions={{
                  color: p.depth_m && p.depth_m > 200 ? "#f97316" : "#2dd4bf",
                  fillColor: p.depth_m && p.depth_m > 200 ? "#f97316" : "#2dd4bf",
                  fillOpacity: 0.75,
                  weight: 1,
                }}
              >
                <Popup>
                  <div style={{ color: "#111", minWidth: "160px" }}>
                    <div style={{ fontWeight: "600", fontSize: "13px", fontStyle: "italic" }}>{p.species_name}</div>
                    {p.common_name && <div style={{ color: "#555", fontSize: "12px" }}>{p.common_name}</div>}
                    <hr style={{ margin: "6px 0", border: "none", borderTop: "1px solid #eee" }} />
                    <div style={{ fontSize: "12px" }}>
                      <div>Lat: {Number(p.lat).toFixed(4)}°</div>
                      <div>Lon: {Number(p.lon).toFixed(4)}°</div>
                      {p.depth_m != null && <div>Depth: {p.depth_m}m</div>}
                      <div style={{ color: "#888", fontSize: "11px", marginTop: "4px" }}>{p.dataset}</div>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {/* Oceanography layer */}
            {activeLayer === "ocean" && oceanPoints.map(p => (
              <CircleMarker
                key={`o-${p.id}`}
                center={[p.lat, p.lon]}
                radius={6}
                pathOptions={{
                  color: getTempColor(p.temperature_c),
                  fillColor: getTempColor(p.temperature_c),
                  fillOpacity: 0.8,
                  weight: 1,
                }}
              >
                <Popup>
                  <div style={{ color: "#111", minWidth: "160px" }}>
                    <div style={{ fontWeight: "600", fontSize: "13px" }}>Oceanography reading</div>
                    <hr style={{ margin: "6px 0", border: "none", borderTop: "1px solid #eee" }} />
                    <div style={{ fontSize: "12px" }}>
                      <div>Lat: {Number(p.lat).toFixed(4)}°</div>
                      <div>Lon: {Number(p.lon).toFixed(4)}°</div>
                      {p.temperature_c != null && <div>Temperature: <strong>{p.temperature_c}°C</strong></div>}
                      {p.salinity_ppt != null && <div>Salinity: {p.salinity_ppt} ppt</div>}
                      {p.chlorophyll != null && <div>Chlorophyll: {p.chlorophyll} mg/m³</div>}
                      {p.dissolved_oxygen != null && <div>DO: {p.dissolved_oxygen} mg/L</div>}
                      {p.depth_m != null && <div>Depth: {p.depth_m}m</div>}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {/* Fisheries layer */}
            {activeLayer === "fisheries" && fishPoints.map(p => (
              <CircleMarker
                key={`f-${p.id}`}
                center={[p.lat, p.lon]}
                radius={Math.min(12, Math.max(5, (p.catch_kg || 0) / 200))}
                pathOptions={{
                  color: getCpueColor(p.catch_kg, p.effort_hours),
                  fillColor: getCpueColor(p.catch_kg, p.effort_hours),
                  fillOpacity: 0.7,
                  weight: 1,
                }}
              >
                <Popup>
                  <div style={{ color: "#111", minWidth: "160px" }}>
                    <div style={{ fontWeight: "600", fontSize: "13px", fontStyle: "italic" }}>{p.species_name}</div>
                    <div style={{ color: "#555", fontSize: "12px" }}>{p.fishing_zone} · {p.gear_type}</div>
                    <hr style={{ margin: "6px 0", border: "none", borderTop: "1px solid #eee" }} />
                    <div style={{ fontSize: "12px" }}>
                      <div>Lat: {Number(p.lat).toFixed(4)}°</div>
                      <div>Lon: {Number(p.lon).toFixed(4)}°</div>
                      {p.catch_kg != null && <div>Catch: <strong>{p.catch_kg} kg</strong></div>}
                      {p.effort_hours != null && <div>Effort: {p.effort_hours} hrs</div>}
                      {p.catch_kg && p.effort_hours && (
                        <div>CPUE: <strong>{(p.catch_kg / p.effort_hours).toFixed(1)} kg/hr</strong></div>
                      )}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
}