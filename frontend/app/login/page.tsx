"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "", password: "", full_name: "", username: ""
  });

  const handle = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const res = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Something went wrong");
      localStorage.setItem("ocean_token", data.access_token);
      localStorage.setItem("ocean_user", JSON.stringify(data.user));
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#021526",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "sans-serif",
    }}>
      {/* Background circles */}
      <div style={{ position: "fixed", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: "rgba(13,148,136,0.08)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -100, left: -100, width: 350, height: 350, borderRadius: "50%", background: "rgba(6,182,212,0.06)", pointerEvents: "none" }} />

      <div style={{
        background: "#0d2137", border: "1px solid #1e3a5f",
        borderRadius: 16, padding: "40px 36px", width: 400,
        boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 4 }}>🌊</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>OceanAI</div>
          <div style={{ fontSize: 12, color: "#2dd4bf", marginTop: 2 }}>Marine Research Platform</div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", background: "#021526", borderRadius: 8, padding: 4, marginBottom: 24 }}>
          {(["login", "register"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); }}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 6, border: "none",
                background: mode === m ? "#0d9488" : "transparent",
                color: mode === m ? "#fff" : "#6b7280", cursor: "pointer",
                fontSize: 13, fontWeight: 500, textTransform: "capitalize",
              }}>
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        {/* Form fields */}
        {mode === "register" && (
          <>
            <input name="full_name" placeholder="Full Name" value={form.full_name} onChange={handle}
              style={inputStyle} />
            <input name="username" placeholder="Username" value={form.username} onChange={handle}
              style={inputStyle} />
          </>
        )}
        <input name="email" placeholder="Email address" type="email" value={form.email} onChange={handle}
          style={inputStyle} />
        <input name="password" placeholder="Password" type="password" value={form.password} onChange={handle}
          style={inputStyle}
          onKeyDown={e => e.key === "Enter" && submit()}
        />

        {error && (
          <div style={{ background: "#7f1d1d", border: "1px solid #dc2626", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#fca5a5" }}>
            {error}
          </div>
        )}

        <button onClick={submit} disabled={loading}
          style={{
            width: "100%", padding: "12px 0", borderRadius: 8, border: "none",
            background: loading ? "#0d9488aa" : "#0d9488",
            color: "#fff", fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
            marginBottom: 16,
          }}>
          {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>

        <div style={{ textAlign: "center", fontSize: 12, color: "#4b5563" }}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            style={{ background: "none", border: "none", color: "#2dd4bf", cursor: "pointer", fontSize: 12 }}>
            {mode === "login" ? "Register here" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 8,
  border: "1px solid #1e3a5f", background: "#021526",
  color: "#fff", fontSize: 14, marginBottom: 14,
  outline: "none", boxSizing: "border-box",
};