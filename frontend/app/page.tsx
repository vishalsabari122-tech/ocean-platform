"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import axios from "axios";

const OceanMap = dynamic(() => import("./components/OceanMap"), { ssr: false });
const TimeSeriesCharts = dynamic(() => import("./components/TimeSeriesCharts"), { ssr: false });

const API = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000" });

export default function Home() {
  const [summary, setSummary] = useState<any>(null);
  const [crossDomain, setCrossDomain] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any>(null);
  const [fishingPressure, setFishingPressure] = useState<any>(null);
  const [tempCatch, setTempCatch] = useState<any>(null);
  const [speciesEnv, setSpeciesEnv] = useState<any>(null);
  const [observations, setObservations] = useState<any[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<any>(null);
  const [asking, setAsking] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [stockPredictions, setStockPredictions] = useState<any>(null);
  const [habitatScores, setHabitatScores] = useState<any>(null);


  useEffect(() => {
    API.get("/ai/summary").then(r => setSummary(r.data));
    API.get("/ai/anomalies").then(r => setAnomalies(r.data));
    API.get("/observations").then(r => setObservations(r.data.results || []));
    API.get("/correlations/summary").then(r => setCrossDomain(r.data));
    API.get("/correlations/fishing-pressure").then(r => setFishingPressure(r.data));
    API.get("/correlations/temperature-catch").then(r => setTempCatch(r.data));
    API.get("/correlations/species-environment").then(r => setSpeciesEnv(r.data));
    API.get("/ml/predict/stock").then(r => setStockPredictions(r.data));
    API.get("/ml/predict/habitat").then(r => setHabitatScores(r.data));
  }, []);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setAsking(true);
    setAnswer(null);
    try {
      const r = await API.post(`/ai/ask?question=${encodeURIComponent(question)}`);
      setAnswer(r.data);
    } catch { setAnswer({ error: "Failed" }); }
    setAsking(false);
  };

  const handleUpload = async (domain: string, file: File) => {
    setUploading(domain);
    setUploadResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const r = await API.post(`/upload/${domain}`, form, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setUploadResult({ domain, ...r.data });
      API.get("/correlations/summary").then(r => setCrossDomain(r.data));
    } catch { setUploadResult({ domain, error: "Upload failed" }); }
    setUploading(null);
  };

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "correlations", label: "Correlations" },
    { id: "map", label: "Species Map" },
    { id: "trends", label: "Trends" },
    { id: "anomalies", label: "Anomalies" },
    { id: "predictions", label: "ML Predictions" },
    { id: "upload", label: "Upload Data" },
    { id: "ai", label: "AI Assistant" },
  ];

  const statusColor = (status: string) => {
    if (status === "overfished") return "text-red-400";
    if (status === "moderate") return "text-yellow-400";
    return "text-green-400";
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">

      {/* Sidebar */}
      <div className="w-52 bg-gray-900 border-r border-gray-800 flex flex-col p-4 gap-1">
        <div className="text-teal-400 font-bold text-lg mb-4 mt-2">OceanAI</div>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`text-left px-3 py-2 rounded-lg text-sm transition-all ${
              activeTab === tab.id ? "bg-teal-600 text-white" : "text-gray-400 hover:bg-gray-800"
            }`}>
            {tab.label}
          </button>
        ))}

        {/* Domain status */}
        <div className="mt-auto pt-4 border-t border-gray-800 space-y-2">
          <div className="text-xs text-gray-500 mb-2">Data loaded</div>
          <div className="flex justify-between text-xs">
            <span className="text-blue-400">Ocean</span>
            <span className="text-white">{crossDomain?.oceanography?.total ?? 0}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-teal-400">Fisheries</span>
            <span className="text-white">{crossDomain?.fisheries?.total ?? 0}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-purple-400">Biodiversity</span>
            <span className="text-white">{crossDomain?.biodiversity?.total ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-5">
            <h1 className="text-2xl font-semibold">Ocean Platform Dashboard</h1>

            {/* 6 stat cards */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Ocean readings", value: crossDomain?.oceanography?.total, sub: `Avg temp: ${crossDomain?.oceanography?.avg_temp ?? "—"}°C`, color: "text-blue-400" },
                { label: "Fisheries records", value: crossDomain?.fisheries?.total, sub: `Total catch: ${crossDomain?.fisheries?.total_catch_kg ?? "—"} kg`, color: "text-teal-400" },
                { label: "Species observations", value: crossDomain?.biodiversity?.total, sub: `${crossDomain?.biodiversity?.unique_species ?? "—"} unique species`, color: "text-purple-400" },
                { label: "Anomalies flagged", value: anomalies?.anomalies_found, sub: "Depth outliers", color: "text-orange-400" },
                { label: "Avg chlorophyll", value: crossDomain?.oceanography?.avg_chlorophyll, sub: "mg/m³", color: "text-green-400" },
                { label: "Avg salinity", value: crossDomain?.oceanography?.avg_salinity, sub: "ppt", color: "text-cyan-400" },
              ].map((card, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className={`text-3xl font-bold ${card.color}`}>{card.value ?? "..."}</div>
                  <div className="text-gray-400 text-sm mt-1">{card.label}</div>
                  <div className="text-gray-600 text-xs mt-1">{card.sub}</div>
                </div>
              ))}
            </div>

            {/* Top species */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-lg font-medium mb-4">Top Species by Observations</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left pb-2">Scientific name</th>
                    <th className="text-left pb-2">Common name</th>
                    <th className="text-right pb-2">Observations</th>
                  </tr>
                </thead>
                <tbody>
                  {summary?.top_species?.map((s: any, i: number) => (
                    <tr key={i} className="border-b border-gray-800 hover:bg-gray-800">
                      <td className="py-2 text-teal-300 italic">{s.species_name}</td>
                      <td className="py-2 text-gray-400">{s.common_name ?? "—"}</td>
                      <td className="py-2 text-right text-white">{s.observations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CORRELATIONS */}
        {activeTab === "correlations" && (
          <div className="space-y-5">
            <h1 className="text-2xl font-semibold">Cross-Domain Correlations</h1>

            {/* Temperature vs Catch */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-lg font-medium mb-1">Temperature vs Catch Rate</h2>
              <p className="text-gray-500 text-xs mb-4">How ocean temperature zones affect fishing yields</p>
              {tempCatch?.data ? (
                <div className="space-y-3">
                  {tempCatch.data.map((row: any, i: number) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-44 text-sm text-gray-300">{row.temp_zone}</div>
                      <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
                        <div
                          className="h-4 rounded-full bg-teal-500"
                          style={{ width: `${Math.min((row.avg_catch_kg / 1200) * 100, 100)}%` }}
                        />
                      </div>
                      <div className="w-32 text-right text-sm text-white">{row.avg_catch_kg} kg avg</div>
                      <div className="w-20 text-right text-xs text-gray-500">{row.avg_temp}°C</div>
                    </div>
                  ))}
                </div>
              ) : <div className="text-gray-500 text-sm">Upload overlapping oceanography + fisheries CSVs to see this correlation.</div>}
            </div>

            {/* Species environment */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-lg font-medium mb-1">Species Environmental Preferences</h2>
              <p className="text-gray-500 text-xs mb-4">Temperature, salinity and chlorophyll conditions where each species was observed</p>
              {speciesEnv?.data ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left pb-2">Species</th>
                      <th className="text-right pb-2">Sightings</th>
                      <th className="text-right pb-2">Avg temp (°C)</th>
                      <th className="text-right pb-2">Salinity (ppt)</th>
                      <th className="text-right pb-2">Chlorophyll</th>
                    </tr>
                  </thead>
                  <tbody>
                    {speciesEnv.data.map((r: any, i: number) => (
                      <tr key={i} className="border-b border-gray-800 hover:bg-gray-800">
                        <td className="py-2">
                          <div className="text-teal-300 italic text-xs">{r.species_name}</div>
                          <div className="text-gray-500 text-xs">{r.common_name}</div>
                        </td>
                        <td className="py-2 text-right text-white">{r.sightings}</td>
                        <td className="py-2 text-right text-blue-400">{r.avg_temp_c}</td>
                        <td className="py-2 text-right text-cyan-400">{r.avg_salinity}</td>
                        <td className="py-2 text-right text-green-400">{r.avg_chlorophyll}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="text-gray-500 text-sm">Upload overlapping biodiversity + oceanography CSVs to see species preferences.</div>}
            </div>

            {/* Fishing pressure */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-lg font-medium mb-1">Fishing Pressure by Zone</h2>
              <p className="text-gray-500 text-xs mb-4">CPUE = catch per unit effort (kg/hr) — lower means more pressure on the stock</p>
              {fishingPressure?.data ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left pb-2">Zone</th>
                      <th className="text-left pb-2">Species</th>
                      <th className="text-right pb-2">Total catch (kg)</th>
                      <th className="text-right pb-2">Effort (hrs)</th>
                      <th className="text-right pb-2">CPUE</th>
                      <th className="text-right pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fishingPressure.data.map((r: any, i: number) => (
                      <tr key={i} className="border-b border-gray-800 hover:bg-gray-800">
                        <td className="py-2 text-gray-300">{r.fishing_zone}</td>
                        <td className="py-2 text-teal-300 italic text-xs">{r.species_name}</td>
                        <td className="py-2 text-right text-white">{r.total_catch_kg}</td>
                        <td className="py-2 text-right text-gray-400">{r.total_effort_hours}</td>
                        <td className="py-2 text-right text-white">{r.cpue}</td>
                        <td className={`py-2 text-right font-medium text-xs ${statusColor(r.stock_status)}`}>
                          {r.stock_status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="text-gray-500 text-sm">Upload fisheries CSV with zone and effort data.</div>}
            </div>
          </div>
        )}
        
        {/* TRENDS */}
        {activeTab === "trends" && (
          <div className="space-y-5">
            <h1 className="text-2xl font-semibold">Time-Series Trends</h1>
            <p className="text-gray-500 text-sm">
              Temperature, catch rates, CPUE health, and species accumulation over time.
              Upload CSVs with date columns to populate all charts.
            </p>
            <TimeSeriesCharts />
          </div>
        )}




        {/* MAP */}
        {activeTab === "map" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Ocean Data Map</h1>
            <p className="text-gray-500 text-sm">Real GPS coordinates from uploaded datasets. Switch layers to see species, temperature, and catch locations.</p>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden" style={{ height: "650px" }}>
              <OceanMap observations={observations} />
            </div>
          </div>
        )}

        {/* ANOMALIES */}
        {activeTab === "anomalies" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Depth Anomalies</h1>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex gap-6 mb-4 text-sm text-gray-400">
                <span>Mean depth: <span className="text-white">{anomalies?.mean_depth_m}m</span></span>
                <span>Std dev: <span className="text-white">{anomalies?.stdev_depth_m}m</span></span>
                <span>Anomalies: <span className="text-orange-400 font-bold">{anomalies?.anomalies_found}</span></span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left pb-2">Species</th>
                    <th className="text-right pb-2">Depth (m)</th>
                    <th className="text-right pb-2">Z-score</th>
                    <th className="text-right pb-2">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies?.anomalies?.map((a: any, i: number) => (
                    <tr key={i} className="border-b border-gray-800 hover:bg-gray-800">
                      <td className="py-2 text-teal-300 italic">{a.species_name}</td>
                      <td className="py-2 text-right text-white">{a.depth_m}</td>
                      <td className="py-2 text-right text-orange-400">{a.z_score}</td>
                      <td className="py-2 text-right text-red-400 text-xs">{a.flag}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* ML PREDICTIONS */}
        {activeTab === "predictions" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold">ML Predictions</h1>
              <button
                onClick={() => {
                  API.get("/ml/train").then(() => {
                    API.get("/ml/predict/stock").then(r => setStockPredictions(r.data));
                    API.get("/ml/predict/habitat").then(r => setHabitatScores(r.data));
                  });
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm"
              >
                Retrain Model
              </button>
            </div>

            {/* Summary risk cards */}
            {stockPredictions?.summary && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-red-950 border border-red-700 rounded-xl p-5">
                  <div className="text-3xl font-bold text-red-400">{stockPredictions.summary.high_risk_zones}</div>
                  <div className="text-red-300 text-sm mt-1">High risk zones</div>
                  <div className="text-red-600 text-xs mt-1">Reduce fishing effort immediately</div>
                </div>
                <div className="bg-yellow-950 border border-yellow-700 rounded-xl p-5">
                  <div className="text-3xl font-bold text-yellow-400">{stockPredictions.summary.medium_risk_zones}</div>
                  <div className="text-yellow-300 text-sm mt-1">Medium risk zones</div>
                  <div className="text-yellow-600 text-xs mt-1">Monitor closely</div>
                </div>
                <div className="bg-green-950 border border-green-700 rounded-xl p-5">
                  <div className="text-3xl font-bold text-green-400">{stockPredictions.summary.low_risk_zones}</div>
                  <div className="text-green-300 text-sm mt-1">Healthy zones</div>
                  <div className="text-green-600 text-xs mt-1">Sustainable fishing</div>
                </div>
              </div>
            )}

            {/* Stock predictions table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-lg font-medium mb-1">Stock Health Predictions</h2>
              <p className="text-gray-500 text-xs mb-4">XGBoost model trained on {stockPredictions?.predictions_count ? `${stockPredictions.predictions_count * 37} samples` : "current data"} — predicts CPUE (catch per unit effort)</p>
              {stockPredictions?.predictions ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left pb-2">Species</th>
                      <th className="text-left pb-2">Zone</th>
                      <th className="text-right pb-2">Actual CPUE</th>
                      <th className="text-right pb-2">Predicted CPUE</th>
                      <th className="text-right pb-2">Trend</th>
                      <th className="text-right pb-2">Suitability</th>
                      <th className="text-right pb-2">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockPredictions.predictions.map((p: any, i: number) => (
                      <tr key={i} className="border-b border-gray-800 hover:bg-gray-800">
                        <td className="py-3">
                          <div className="text-teal-300 italic text-xs">{p.species_name}</div>
                          <div className="text-gray-600 text-xs mt-0.5">{p.recommendation}</div>
                        </td>
                        <td className="py-3 text-gray-300">{p.fishing_zone}</td>
                        <td className="py-3 text-right text-gray-400">{p.actual_cpue}</td>
                        <td className="py-3 text-right text-white font-medium">{p.predicted_cpue}</td>
                        <td className="py-3 text-right">
                          <span className={p.trend === "improving" ? "text-green-400" : "text-red-400"}>
                            {p.trend === "improving" ? "↑" : "↓"} {p.trend}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-gray-700 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full bg-teal-400"
                                style={{ width: `${p.habitat_suitability_score}%` }}
                              />
                            </div>
                            <span className="text-gray-400 text-xs">{p.habitat_suitability_score}%</span>
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                            p.depletion_risk === "high" ? "bg-red-900 text-red-300" :
                            p.depletion_risk === "medium" ? "bg-yellow-900 text-yellow-300" :
                            "bg-green-900 text-green-300"
                          }`}>
                            {p.depletion_risk}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-500 text-sm mb-3">No predictions yet</div>
                  <button
                    onClick={() => API.get("/ml/train").then(() => API.get("/ml/predict/stock").then(r => setStockPredictions(r.data)))}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    Train model and predict
                  </button>
                </div>
              )}
            </div>

            {/* Habitat suitability */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-lg font-medium mb-1">Habitat Suitability Scores</h2>
              <p className="text-gray-500 text-xs mb-4">How well each fishing zone matches each species' preferred environmental conditions</p>
              {habitatScores?.habitat_scores ? (
                <div className="grid grid-cols-2 gap-3">
                  {habitatScores.habitat_scores.slice(0, 12).map((h: any, i: number) => (
                    <div key={i} className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-teal-300 italic text-xs truncate">{h.species_name}</div>
                        <div className="text-gray-500 text-xs">{h.common_name ?? "—"} · {h.zone}</div>
                        <div className="text-gray-600 text-xs mt-0.5">{h.pref_temp_c}°C pref / {h.zone_temp_c}°C zone</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`text-lg font-bold ${
                          h.suitability_score >= 80 ? "text-green-400" :
                          h.suitability_score >= 60 ? "text-yellow-400" : "text-red-400"
                        }`}>{h.suitability_score}%</div>
                        <div className={`text-xs ${
                          h.rating === "excellent" ? "text-green-500" :
                          h.rating === "good" ? "text-yellow-500" : "text-red-500"
                        }`}>{h.rating}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-sm">Upload biodiversity + oceanography CSVs from the same region to generate habitat scores.</div>
              )}
            </div>
          </div>
        )}






        {/* UPLOAD */}
        {activeTab === "upload" && (
          <div className="space-y-5">
            <h1 className="text-2xl font-semibold">Upload Dataset</h1>
            <p className="text-gray-400 text-sm">Upload CSV files for each domain. The platform auto-detects columns and links datasets by location and date.</p>

            <div className="grid grid-cols-3 gap-4">
              {[
                { domain: "oceanography", label: "Oceanography", color: "border-blue-600", desc: "temperature, salinity, depth, chlorophyll, dissolved_oxygen, ph", example: "date, lat, lon, temperature_c, salinity_ppt..." },
                { domain: "fisheries", label: "Fisheries", color: "border-teal-600", desc: "catch records, effort, vessel, gear type, fishing zone", example: "date, lat, lon, species_name, catch_kg, effort_hours..." },
                { domain: "biodiversity", label: "Biodiversity", color: "border-purple-600", desc: "species occurrences, abundance, habitat, survey method", example: "date, lat, lon, species_name, common_name, abundance..." },
              ].map(({ domain, label, color, desc, example }) => (
                <div key={domain} className={`bg-gray-900 border ${color} border-2 rounded-xl p-5`}>
                  <h3 className="font-medium mb-2">{label}</h3>
                  <p className="text-gray-500 text-xs mb-3">{desc}</p>
                  <p className="text-gray-700 text-xs font-mono mb-4">{example}</p>
                  <label className={`block w-full text-center py-3 rounded-lg border ${color} border-dashed cursor-pointer hover:bg-gray-800 text-sm text-gray-400 transition-all`}>
                    {uploading === domain ? "Uploading..." : "Drop CSV or click to browse"}
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(domain, file);
                      }}
                    />
                  </label>
                </div>
              ))}
            </div>

            {uploadResult && (
              <div className={`rounded-xl p-5 border ${uploadResult.error ? "border-red-700 bg-red-950" : "border-green-700 bg-green-950"}`}>
                {uploadResult.error ? (
                  <div className="text-red-400">{uploadResult.error}</div>
                ) : (
                  <div className="space-y-1 text-sm">
                    <div className="text-green-400 font-medium">Successfully uploaded {uploadResult.domain} data</div>
                    <div className="text-gray-400">Rows in file: <span className="text-white">{uploadResult.rows_in_file}</span></div>
                    <div className="text-gray-400">Saved to database: <span className="text-white">{uploadResult.saved}</span></div>
                    <div className="text-gray-400">Columns detected: <span className="text-white font-mono text-xs">{uploadResult.columns_detected?.join(", ")}</span></div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* AI ASSISTANT */}
        {activeTab === "ai" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold">AI Research Assistant</h1>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-gray-400 text-sm mb-4">Ask any question about the ocean data in plain English.</p>
              <div className="flex gap-3">
                <input
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500"
                  placeholder="e.g. Which whale species were observed in warm water?"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAsk()}
                />
                <button onClick={handleAsk} disabled={asking}
                  className="bg-teal-600 hover:bg-teal-500 disabled:bg-gray-700 text-white px-5 py-2 rounded-lg text-sm transition-all">
                  {asking ? "Thinking..." : "Ask"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  "Which whale species are in the database",
                  "Which species below 500m depth",
                  "Top 5 most observed species",
                  "Which fishing zone has highest catch",
                  "Average temperature in the dataset",
                ].map(q => (
                  <button key={q} onClick={() => setQuestion(q)}
                    className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-1 rounded-full border border-gray-700">
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {answer && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
                {answer.error ? (
                  <div className="text-red-400">{answer.error}</div>
                ) : (
                  <>
                    <div className="text-xs text-gray-500 font-mono bg-gray-800 rounded p-3 overflow-x-auto">
                      {answer.sql_generated}
                    </div>
                    <div className="text-sm text-gray-400">{answer.count} results found</div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 border-b border-gray-800">
                          {answer.results?.[0] && Object.keys(answer.results[0]).map((k: string) => (
                            <th key={k} className="text-left pb-2 capitalize">{k.replace(/_/g, " ")}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {answer.results?.map((row: any, i: number) => (
                          <tr key={i} className="border-b border-gray-800 hover:bg-gray-800">
                            {Object.values(row).map((v: any, j: number) => (
                              <td key={j} className="py-2 text-gray-300">{v ?? "—"}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}