"use client";
// Landing point for magic-link and Google sign-in. Converts the Supabase
// browser session into the app's server cookie, then continues into the app.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { completeBrowserSignIn } from "@/lib/auth/client";

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await completeBrowserSignIn();
      if (cancelled) return;
      if (res?.error) { setError(res.error); return; }
      // Drop the tokens from the address bar before moving on.
      window.history.replaceState({}, "", "/auth/callback");
      router.replace("/app");
      router.refresh();
    })();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <div style={wrap}>
      {error ? (
        <div style={{ textAlign: "center", maxWidth: 320 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: "#FCA5A5" }}>
            <Icon name="warning" size={30} />
          </div>
          <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 6 }}>Sign-in didn't complete</div>
          <div style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.5, marginBottom: 18 }}>{error}</div>
          <button onClick={() => router.replace("/login")} style={btn}>Back to sign in</button>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <div style={badge}><Icon name="building" size={26} style={{ color: "#fff" }} /></div>
          <div style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Signing you in…</div>
          <div style={{ fontSize: 13, opacity: 0.65, marginBottom: 18 }}>One moment</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", animation: "pulse 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const wrap = {
  minHeight: "100vh", background: "#071223", color: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 24, fontFamily: "var(--font-body), sans-serif",
};
const badge = {
  width: 52, height: 52, borderRadius: 15, margin: "0 auto 16px",
  background: "linear-gradient(135deg,#0D1B33,#2C4A5E)",
  display: "flex", alignItems: "center", justifyContent: "center",
  boxShadow: "0 8px 24px rgba(13,27,51,.5)",
};
const btn = {
  background: "#0D1B33", color: "#fff", border: "none", borderRadius: 10,
  padding: "11px 20px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit",
};
