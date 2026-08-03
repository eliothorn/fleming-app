"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, viewAs, liveMode } from "@/lib/auth/client";
import Icon from "@/components/ui/Icon";
import PhoneApp from "@/components/PhoneApp";

async function jsonFetch(url, options) {
  const res = await fetch(url, { cache: "no-store", ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
const send = (url, method, body) =>
  jsonFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });

export default function AppClient() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError(""); // clear a previous failure so Retry can actually recover
    try { setData(await jsonFetch("/api/buildium/bootstrap")); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSignOut = async () => { await signOut(); router.push("/login"); router.refresh(); };
  const handleViewAs = async (role) => {
    const res = await viewAs(role);
    if (res.error) return;
    setData(null);
    await load();
  };

  // Backend-persisting actions. Components update their own local state for snappy
  // UX and call these to write through to the API (mock Buildium now, real later).
  const api = {
    createOrder: (input) => send("/api/buildium/orders", "POST", input).then((r) => r.order),
    updateOrder: (id, patch) => send(`/api/buildium/orders/${id}`, "PATCH", patch).then((r) => r.order),
    addInspection: (input) => send("/api/inspections", "POST", input).then((r) => r.inspection),
    createTemplate: (input) => send("/api/buildium/templates", "POST", input).then((r) => r.template),
    updateTemplate: (id, patch) => send(`/api/buildium/templates/${id}`, "PATCH", patch).then((r) => r.template),
    deleteTemplate: (id) => send(`/api/buildium/templates/${id}`, "DELETE"),
  };

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#071223", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "var(--font-body), sans-serif", padding: 24, textAlign: "center" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: "#FCA5A5" }}><Icon name="warning" size={30} /></div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Couldn't load your data</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>{error}</div>
          <button onClick={load} style={{ marginTop: 16, background: "#0D1B33", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>Retry</button>
        </div>
      </div>
    );
  }

  if (!data) {
    // A first load against live Buildium pages a lot of records and can take
    // several seconds — an unlabelled black screen reads as a broken app.
    return (
      <div style={{ minHeight: "100vh", background: "#071223", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "var(--font-body), sans-serif", padding: 24, textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: 15, background: "linear-gradient(135deg,#0D1B33,#2C4A5E)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, boxShadow: "0 8px 24px rgba(13,27,51,.5)" }}><Icon name="building" size={26} style={{ color: "#fff" }} /></div>
        <div style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 19, fontWeight: 600, letterSpacing: ".04em", marginBottom: 6 }}>FLEMING REALTY</div>
        <div style={{ fontSize: 13, opacity: 0.65, marginBottom: 18 }}>Loading your properties…</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", animation: "pulse 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <PhoneApp
      initial={data}
      api={api}
      onSignOut={handleSignOut}
      onViewAs={handleViewAs}
      canViewAs={!liveMode}
      onReload={load}
    />
  );
}
