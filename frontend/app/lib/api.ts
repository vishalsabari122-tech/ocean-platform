import axios from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const API = axios.create({ baseURL: BASE_URL });

export const getSummary = () => API.get("/ai/summary");
export const getAnomalies = () => API.get("/ai/anomalies");
export const getHotspots = () => API.get("/ai/hotspots");
export const getObservations = () => API.get("/observations");
export const askQuestion = (question: string) =>
  API.post(`/ai/ask?question=${encodeURIComponent(question)}`);