"use client";
import { useEffect, useState } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from "recharts";
import axios from "axios";

const API = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000" });
const COLORS = {
  temp: "#ef4444",
  tempMin: "#3b82f6",
  tempMax: "#f97316",
  salinity: "#06b6d4",
  chlorophyll: "#10b981",
  do: "#8b5cf6",
  cpue: "#2dd4bf",
  catch: "#f59e0b",
  species: "#a78bfa",
  cumulative: "#34d399",
};

const SPECIES_COLORS = [
  "#2dd4bf", "#f59e0b", "#ef4444", "#a78bfa", "#60a5fa",
  "#f472b6", "#34d399", "#fb923c"
];

function formatDate(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function NoData({ message }: { message: string }) {
  return (
    <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", color: "#4b5563" }}>
        <div style={{ fontSize: 14 }}>{message}</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>Upload CSV data with date columns to see trends</div>
      </div>
    </div>
  );
}

export default function TimeSeriesCharts() {
  const [tempData, setTempData] = useState<any[]>([]);
  const [catchData, setCatchData] = useState<any[]>([]);
  const [speciesData, setSpeciesData] = useState<any[]>([]);
  const [cpueData, setCpueData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState("temperature");
  const [catchSpecies, setCatchSpecies] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      API.get("/timeseries/temperature"),
      API.get("/timeseries/catch"),
      API.get("/timeseries/species"),
      API.get("/timeseries/cpue-trend"),
    ]).then(([t, c, s, cpue]) => {
      const td = (t.data.data || []).map((r: any) => ({
        ...r, date: formatDate(r.date)
      }));
      setTempData(td);

      const cd = c.data.data || [];
      const species = [...new Set(cd.map((r: any) => r.species_name))] as string[];
      setCatchSpecies(species);

      const catchByDate: Record<string, any> = {};
      cd.forEach((r: any) => {
        const d = formatDate(r.date);
        if (!catchByDate[d]) catchByDate[d] = { date: d };
        catchByDate[d][r.species_name] = r.total_catch_kg;
        catchByDate[d][`${r.species_name}_cpue`] = r.daily_cpue;
      });
      setCatchData(Object.values(catchByDate));

      setSpeciesData((s.data.data || []).map((r: any) => ({
        ...r, date: formatDate(r.date)
      })));

      setCpueData((cpue.data.data || []).map((r: any) => ({
        ...r, date: formatDate(r.date)
      })));

      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const chartTabs = [
    { id: "temperature", label: "Temperature & salinity" },
    { id: "catch", label: "Catch over time" },
    { id: "cpue", label: "CPUE trend" },
    { id: "species", label: "Species accumulation" },
  ];

  const tooltipStyle = {
    backgroundColor: "#1f2937",
    border: "1px solid #374151",
    borderRadius: 8,
    color: "#f9fafb",
    fontSize: 12,
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
        Loading time-series data...
      </div>
    );
  }

  return (
    <div>
      {/* Chart tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {chartTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveChart(tab.id)}
            style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              border: `1px solid ${activeChart === tab.id ? "#2dd4bf" : "#374151"}`,
              background: activeChart === tab.id ? "#0d9488" : "transparent",
              color: activeChart === tab.id ? "#fff" : "#9ca3af",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Temperature & Salinity */}
      {activeChart === "temperature" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#f9fafb", marginBottom: 4 }}>Sea surface temperature over time</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Daily min / avg / max (°C)</div>
            {tempData.length === 0 ? <NoData message="No oceanography time-series data yet" /> : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={tempData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} unit="°C" domain={["auto", "auto"]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#9ca3af" }} />
                  <Area type="monotone" dataKey="max_temp" stroke="#f97316" fill="#f9730620" strokeWidth={1.5} name="Max temp" />
                  <Area type="monotone" dataKey="avg_temp" stroke="#ef4444" fill="#ef444430" strokeWidth={2} name="Avg temp" />
                  <Area type="monotone" dataKey="min_temp" stroke="#3b82f6" fill="#3b82f620" strokeWidth={1.5} name="Min temp" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: "#f9fafb", marginBottom: 4 }}>Salinity trend</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Daily average (ppt)</div>
              {tempData.length === 0 ? <NoData message="No data yet" /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={tempData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} unit=" ppt" domain={["auto", "auto"]} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="avg_salinity" stroke={COLORS.salinity} strokeWidth={2} dot={false} name="Salinity" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: "#f9fafb", marginBottom: 4 }}>Chlorophyll-a</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Daily average (mg/m³) — proxy for phytoplankton</div>
              {tempData.length === 0 ? <NoData message="No data yet" /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={tempData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} domain={["auto", "auto"]} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="avg_chlorophyll" stroke={COLORS.chlorophyll} fill="#10b98130" strokeWidth={2} name="Chlorophyll" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Catch over time */}
      {activeChart === "catch" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#f9fafb", marginBottom: 4 }}>Daily catch by species (kg)</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Stacked — total catch weight per day</div>
            {catchData.length === 0 ? <NoData message="No fisheries time-series data yet" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={catchData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} unit=" kg" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#9ca3af" }} />
                  {catchSpecies.map((sp, i) => (
                    <Bar
                      key={sp}
                      dataKey={sp}
                      stackId="catch"
                      fill={SPECIES_COLORS[i % SPECIES_COLORS.length]}
                      name={sp}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* CPUE trend */}
      {activeChart === "cpue" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#f9fafb", marginBottom: 4 }}>CPUE trend over time</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Catch per unit effort (kg/hr) — declining CPUE = stock depletion signal</div>
            <div style={{ fontSize: 11, color: "#374151", marginBottom: 16 }}>Below 50 kg/hr indicates overfishing pressure</div>
            {cpueData.length === 0 ? <NoData message="No fisheries effort data yet" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={cpueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} unit=" kg/hr" domain={[0, "auto"]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#9ca3af" }} />
                  <Area
                    type="monotone"
                    dataKey="avg_cpue"
                    stroke={COLORS.cpue}
                    fill="#2dd4bf20"
                    strokeWidth={2.5}
                    name="Avg CPUE (kg/hr)"
                    dot={{ fill: "#2dd4bf", r: 4 }}
                  />
                  <Bar dataKey="fishing_events" fill="#37415180" name="Fishing events" yAxisId={0} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#f9fafb", marginBottom: 4 }}>Total daily catch</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>kg per day across all species</div>
            {cpueData.length === 0 ? <NoData message="No data yet" /> : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={cpueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} unit=" kg" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="total_catch" fill={COLORS.catch} name="Total catch (kg)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Species accumulation */}
      {activeChart === "species" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#f9fafb", marginBottom: 4 }}>Cumulative species observations</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>Total records accumulated over time — shows data collection growth</div>
            {speciesData.length === 0 ? <NoData message="No biodiversity time-series data yet" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={speciesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#9ca3af" }} />
                  <Area type="monotone" dataKey="cumulative_observations" stroke={COLORS.cumulative} fill="#34d39920" strokeWidth={2.5} name="Cumulative observations" />
                  <Bar dataKey="daily_observations" fill="#a78bfa60" name="Daily observations" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#f9fafb", marginBottom: 4 }}>Unique species per day</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>How many distinct species observed each survey day</div>
            {speciesData.length === 0 ? <NoData message="No data yet" /> : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={speciesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="unique_species" fill={COLORS.species} name="Unique species" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}