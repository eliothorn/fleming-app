"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { signIn, signUp, sendMagicLink, signInWithGoogle, liveMode } from "@/lib/auth/client";

const C = {
  primary: "#1F2EAD", primaryLight: "#EDEFFC", border: "#E6E9EF",
  text: "#0A0F1E", muted: "#5A6376", faint: "#68707F",
};

// Google's mark must keep its own colours — recolouring it breaks their brand terms.
const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.7 30.1.5 24 .5 14.6.5 6.5 5.9 2.6 13.7l7.8 6c1.9-5.6 7.2-9.7 13.6-9.7z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.4z" />
    <path fill="#FBBC05" d="M10.4 28.3a14.5 14.5 0 0 1 0-8.6l-7.8-6a23.5 23.5 0 0 0 0 20.6l7.8-6z" />
    <path fill="#34A853" d="M24 47.5c6.1 0 11.3-2 15.1-5.5l-7.6-5.9c-2.1 1.4-4.8 2.2-7.5 2.2-6.4 0-11.7-4.1-13.6-9.7l-7.8 6C6.5 42.1 14.6 47.5 24 47.5z" />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [usePassword, setUsePassword] = useState(!liveMode); // staff/dev path
  const [mode, setMode] = useState("login");                 // password mode only
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const magic = async () => {
    if (busy) return;
    setError("");
    if (!email.trim()) { setError("Enter your email address first."); return; }
    setBusy(true);
    const res = await sendMagicLink(email);
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    setSent(true);
  };

  const google = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    const res = await signInWithGoogle();
    if (res?.error) { setBusy(false); setError(res.error); }
    // On success the browser navigates to Google; nothing further to do here.
  };

  const withPassword = async () => {
    if (busy) return;
    setError("");
    if (!email.trim() || !password.trim()) { setError("Please enter your email and password."); return; }
    if (mode === "signup" && !name.trim()) { setError("Please enter your name."); return; }
    setBusy(true);
    const res = await (mode === "login" ? signIn : signUp)({ email: email.trim(), password, name: name.trim() });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    router.push("/app");
    router.refresh();
  };

  const fill = (e) => { setEmail(e); setPassword("demo1234"); setUsePassword(true); setMode("login"); setError(""); };

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0D", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="fl-app" style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 24, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", fontFamily: "var(--font-jakarta), sans-serif" }}>
        <div style={{ background: "linear-gradient(135deg,#1F2EAD,#3B4FD8)", padding: "34px 28px 30px", color: "#fff" }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><Icon name="building" size={24} /></div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>Fleming Realty Group</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 3 }}>Sign in to manage your work orders, lease, and requests</div>
        </div>

        <div style={{ padding: "22px 28px 28px" }}>
          {/* ── Magic link sent ─────────────────────────────────────────────── */}
          {sent ? (
            <div className="fl-fade" style={{ textAlign: "center", padding: "10px 0 4px" }}>
              <div style={{ width: 52, height: 52, borderRadius: 15, background: C.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", color: C.primary }}>
                <Icon name="envelope" size={26} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-.01em", color: C.text, marginBottom: 6 }}>Check your email</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
                We sent a sign-in link to <b style={{ color: C.text }}>{email.trim()}</b>. Tap it on this device and you're in — no password needed.
              </div>
              <div style={{ fontSize: 11.5, color: C.faint, marginTop: 12, lineHeight: 1.5 }}>
                The link expires in about an hour. Check spam if it hasn't arrived in a minute.
              </div>
              <button onClick={() => { setSent(false); setError(""); }} style={{ ...ghostBtn, marginTop: 16 }}>Use a different email</button>
            </div>
          ) : (
            <>
              {/* ── Google ────────────────────────────────────────────────── */}
              {liveMode && (
                <>
                  <button onClick={google} disabled={busy} style={googleBtn}>
                    <GoogleMark />
                    <span>Continue with Google</span>
                  </button>
                  <div style={dividerWrap}>
                    <span style={dividerLine} /><span style={{ fontSize: 11, color: C.faint, fontWeight: 600 }}>or</span><span style={dividerLine} />
                  </div>
                </>
              )}

              {/* ── Email ─────────────────────────────────────────────────── */}
              {usePassword && mode === "signup" && (
                <Field label="Full name">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={inputStyle} />
                </Field>
              )}
              <Field label="Email">
                <input
                  type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (usePassword ? withPassword() : magic())}
                  placeholder="you@email.com" style={inputStyle}
                />
              </Field>
              {usePassword && (
                <Field label="Password">
                  <input
                    type="password" autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && withPassword()}
                    placeholder="••••••••" style={inputStyle}
                  />
                </Field>
              )}

              {error && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", fontSize: 12.5, fontWeight: 600, padding: "10px 12px", borderRadius: 10, marginBottom: 14 }}>{error}</div>
              )}

              <button onClick={usePassword ? withPassword : magic} disabled={busy} style={primaryBtn(busy)}>
                {busy ? "Please wait…" : usePassword ? (mode === "login" ? "Log in" : "Create account") : "Email me a sign-in link"}
              </button>

              {/* Residents rarely log in and will forget passwords; staff use them
                  daily. Default to passwordless, keep passwords one tap away. */}
              {liveMode && (
                <div style={{ textAlign: "center", marginTop: 14 }}>
                  <span
                    onClick={() => { setUsePassword((v) => !v); setError(""); }}
                    style={{ fontSize: 12, color: C.primary, fontWeight: 700, cursor: "pointer" }}
                  >
                    {usePassword ? "← Use a sign-in link instead" : "Sign in with a password instead"}
                  </span>
                </div>
              )}

              {usePassword && liveMode && (
                <div style={{ textAlign: "center", marginTop: 10 }}>
                  <span onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }} style={{ fontSize: 11.5, color: C.faint, cursor: "pointer" }}>
                    {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Dev/demo only — never advertise seeded credentials on a live login page. */}
          {!liveMode && !sent && (
            <div style={{ marginTop: 20, padding: "14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#B45309", marginBottom: 8 }}>Test accounts · tap to fill</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {[["Employee", "marcus@fleming.test"], ["Resident", "sarah@fleming.test"], ["Owner", "robert@fleming.test"], ["Vendor", "daflure@fleming.test"], ["Applicant", "jordan@fleming.test"]].map(([label, e]) => (
                  <div key={e} onClick={() => fill(e)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "6px 8px", borderRadius: 8, background: "#fff", border: "1px solid #FDE68A" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#92400E" }}>{label}</span>
                    <span style={{ fontSize: 11, color: "#B45309" }}>{e}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10.5, color: "#B45309", marginTop: 8 }}>Password for all demo accounts: <b>demo1234</b>.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", border: `1px solid ${C.border}`, borderRadius: 11, padding: "12px 14px", fontSize: 16, fontFamily: "inherit", color: C.text, outline: "none", background: "#fff", boxSizing: "border-box" };
const primaryBtn = (busy) => ({ width: "100%", background: C.primary, color: "#fff", fontSize: 14.5, fontWeight: 700, padding: "13px", borderRadius: 12, border: "none", cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, boxShadow: "0 2px 10px rgba(31,46,173,0.28)", minHeight: 46 });
const googleBtn = { width: "100%", background: "#fff", color: C.text, fontSize: 14, fontWeight: 700, padding: "12px", borderRadius: 12, border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 46, boxShadow: "0 1px 2px rgba(16,24,40,.04)" };
const ghostBtn = { background: "#F7F8FA", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const dividerWrap = { display: "flex", alignItems: "center", gap: 12, margin: "16px 0" };
const dividerLine = { flex: 1, height: 1, background: C.border };

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: C.faint, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
