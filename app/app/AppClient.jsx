"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, viewAs, liveMode, getSession } from "@/lib/auth/client";
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
  // Who is signed in, fetched alongside the payload. The session is one fast
  // lookup; bootstrap can page dozens of throttled Buildium requests. Asking for
  // both at once means the frame and the person's own name appear immediately
  // rather than after everything else has landed.
  const [who, setWho] = useState(null);
  // A skeleton that flashes up and vanishes is more jarring than no skeleton at
  // all, so it waits out a warm load before appearing.
  const [showSkeleton, setShowSkeleton] = useState(false);

  const load = useCallback(async () => {
    setError(""); // clear a previous failure so Retry can actually recover
    try { setData(await jsonFetch("/api/buildium/bootstrap")); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let alive = true;
    getSession().then((u) => { if (alive && u) setWho(u); }).catch(() => {});
    const t = setTimeout(() => { if (alive) setShowSkeleton(true); }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, []);

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
    // A cold load pages a lot of throttled Buildium records and can take a long
    // while. This used to be a centred spinner over "Loading your properties…"
    // — which residents don't have, and which tells you nothing about progress.
    // Now the real frame appears at once with the signed-in person's own name,
    // and the content it is waiting for is outlined in place.
    const name = who?.entity?.name || who?.email || "";
    const first = String(name).split(" ")[0];
    const bar = (w, h = 12, r = 6) => ({ width: w, height: h, borderRadius: r, background: "#ECE8E1", backgroundImage: "linear-gradient(90deg,#ECE8E1 0%,#F6F3EE 50%,#ECE8E1 100%)", backgroundSize: "200% 100%", animation: "flshimmer 1.4s ease-in-out infinite" });
    return (
      <div style={{ background: "#071223", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <style>{`@keyframes flshimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        <div className="fl-app" style={{ width: "min(390px,100vw)", height: "min(844px,100dvh)", background: "#FAF8F4", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "var(--font-body), sans-serif" }}>
          <div className="fl-safe-top" style={{ background: "#fff", padding: "12px 20px 10px", borderBottom: "1px solid #E5E1D8", display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0 }}>
            <div style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 13, fontWeight: 600, letterSpacing: ".12em", color: "#0D1B33" }}>STEPHEN FLEMING REALTY</div>
          </div>

          <div style={{ background: "#fff", padding: "18px 20px 16px", borderBottom: "1px solid #E5E1D8" }}>
            {name ? (
              <>
                <div style={{ fontSize: 12, color: "#4A6A80", fontWeight: 500, marginBottom: 2 }}>Hi {first} 👋</div>
                <div style={{ fontSize: 25, fontWeight: 600, color: "#0D1B33", fontFamily: "var(--font-display), Georgia, serif", lineHeight: 1.15 }}>{name}</div>
              </>
            ) : (
              <>
                <div style={{ ...bar(70, 10), marginBottom: 8 }} />
                <div style={bar(160, 20)} />
              </>
            )}
          </div>

          {showSkeleton && (
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "#fff", border: "1px solid #E5E1D8", borderRadius: 18, padding: 16, display: "flex", gap: 8 }}>
                {[0, 1, 2].map((i) => <div key={i} style={{ flex: 1, height: 52, borderRadius: 10, ...bar("100%", 52, 10) }} />)}
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ background: "#fff", border: "1px solid #E5E1D8", borderRadius: 16, padding: 14, opacity: 1 - i * 0.22 }}>
                  <div style={{ ...bar("70%", 13), marginBottom: 9 }} />
                  <div style={bar("45%", 10)} />
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: "auto", padding: "14px 20px 22px", textAlign: "center", fontSize: 11.5, color: "#4A6A80" }}>
            Fetching the latest from the office…
          </div>
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
