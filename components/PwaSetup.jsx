"use client";
import { useEffect, useState } from "react";

// Registers the service worker and offers "add to home screen".
// Residents and vendors won't find an install option on their own, so the app
// asks — once — and never nags again if dismissed.
const DISMISS_KEY = "fl_install_dismissed";

export default function PwaSetup() {
  const [deferred, setDeferred] = useState(null); // Android/Chrome install event
  const [showIos, setShowIos] = useState(false);  // iOS has no install API
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (standalone) return; // already installed
    if (localStorage.getItem(DISMISS_KEY)) return;

    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS Safari never fires beforeinstallprompt — detect and show instructions.
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIos && isSafari) {
      setShowIos(true);
      setHidden(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setHidden(true);
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    setDeferred(null);
    setHidden(true);
  };

  if (hidden || (!deferred && !showIos)) return null;

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/icon-192.png" alt="" width={42} height={42} style={{ borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0D1B33" }}>Add Fleming to your home screen</div>
            <div style={{ fontSize: 11.5, color: "#4A6A80", marginTop: 2, lineHeight: 1.45 }}>
              {showIos ? (
                <>Tap the Share button, then <b>Add to Home Screen</b>.</>
              ) : (
                <>Open it like an app — no browser, no searching for the link.</>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={dismiss} style={btnGhost}>Not now</button>
          {deferred && <button onClick={install} style={btnPrimary}>Install</button>}
          {showIos && !deferred && <button onClick={dismiss} style={btnPrimary}>Got it</button>}
        </div>
      </div>
    </div>
  );
}

const wrap = {
  position: "fixed",
  left: 0, right: 0,
  bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
  display: "flex", justifyContent: "center",
  padding: "0 12px", zIndex: 9999,
  pointerEvents: "none",
};
const card = {
  pointerEvents: "auto",
  width: "100%", maxWidth: 380,
  background: "#fff", borderRadius: 16,
  border: "1px solid #E5E1D8",
  boxShadow: "0 12px 40px rgba(10,15,30,.28)",
  padding: "14px 15px",
  fontFamily: "var(--font-body), sans-serif",
};
const btnBase = {
  flex: 1, padding: "10px", borderRadius: 10, fontSize: 12.5, fontWeight: 700,
  cursor: "pointer", fontFamily: "inherit",
};
const btnGhost = { ...btnBase, background: "#FAF8F4", color: "#4A6A80", border: "1px solid #E5E1D8" };
const btnPrimary = { ...btnBase, flex: 2, background: "#0D1B33", color: "#fff", border: "none" };
