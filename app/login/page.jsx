"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { signIn, signUp, liveMode } from "@/lib/auth/client";

const C = {
  primary: "#1F2EAD", primaryLight: "#EDEFFC", border: "#E4E7EC",
  text: "#0A0F1E", muted: "#667085", faint: "#98A2B3",
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setError("");
    if (!email.trim() || !password.trim()) { setError("Please enter your email and password."); return; }
    if (mode === "signup" && !name.trim()) { setError("Please enter your name."); return; }
    setBusy(true);
    const fn = mode === "login" ? signIn : signUp;
    const res = await fn({ email: email.trim(), password, name: name.trim() });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    router.push("/app");
    router.refresh();
  };

  const fill = (e) => { setEmail(e); setPassword("demo1234"); setMode("login"); setError(""); };

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0D", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="fl-app" style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 24, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", fontFamily: "var(--font-jakarta), sans-serif" }}>
        {/* Brand header */}
        <div style={{ background: "linear-gradient(135deg,#1F2EAD,#3B4FD8)", padding: "34px 28px 30px", color: "#fff" }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><Icon name="building" size={24} /></div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>Fleming Realty Group</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 3 }}>Sign in to manage your work orders, lease, and requests</div>
        </div>

        <div style={{ padding: "22px 28px 28px" }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, background: "#F2F3F7", borderRadius: 12, padding: 4, marginBottom: 20 }}>
            {["login", "signup"].map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(""); }} style={{ flex: 1, padding: "9px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: mode === m ? "#fff" : "transparent", color: mode === m ? C.primary : C.muted, boxShadow: mode === m ? "0 1px 3px rgba(16,24,40,0.1)" : "none" }}>
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          {mode === "signup" && (
            <Field label="Full name">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={inputStyle} />
            </Field>
          )}
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="you@email.com" style={inputStyle} />
          </Field>
          <Field label="Password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="••••••••" style={inputStyle} />
          </Field>

          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", fontSize: 12.5, fontWeight: 600, padding: "10px 12px", borderRadius: 10, marginBottom: 14 }}>{error}</div>
          )}

          <button onClick={submit} disabled={busy} style={{ width: "100%", background: C.primary, color: "#fff", fontSize: 14.5, fontWeight: 700, padding: "13px", borderRadius: 12, border: "none", cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, boxShadow: "0 2px 10px rgba(31,46,173,0.28)" }}>
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>

          {/* Test-account shortcuts are for demo/dev only — never advertise seeded
              credentials on a login page that is serving real resident accounts. */}
          {!liveMode && (
            <div style={{ marginTop: 20, padding: "14px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#B45309", marginBottom: 8 }}>Test accounts · tap to fill</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {[
                  ["Employee", "marcus@fleming.test"],
                  ["Resident", "sarah@fleming.test"],
                  ["Owner", "robert@fleming.test"],
                  ["Vendor", "daflure@fleming.test"],
                  ["Applicant", "jordan@fleming.test"],
                ].map(([label, e]) => (
                  <div key={e} onClick={() => fill(e)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "6px 8px", borderRadius: 8, background: "#fff", border: "1px solid #FDE68A" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#92400E" }}>{label}</span>
                    <span style={{ fontSize: 11, color: "#B45309" }}>{e}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10.5, color: "#B45309", marginTop: 8 }}>Password for all demo accounts: <b>demo1234</b>. Or sign up with any email to see the new-resident flow.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", border: `1px solid ${C.border}`, borderRadius: 11, padding: "12px 14px", fontSize: 14, fontFamily: "inherit", color: C.text, outline: "none", background: "#fff", boxSizing: "border-box" };

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: C.faint, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
