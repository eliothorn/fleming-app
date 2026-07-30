"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

// Real photo capture. `capture="environment"` makes a phone open the rear camera
// directly instead of a file browser; on desktop the same input falls back to a
// file picker, so one control covers both.
//
// The file uploads immediately to /api/photos and the caller receives an opaque
// storage path — so a half-filled inspection never holds a large image in memory,
// and the photo survives a page reload.

const C = {
  navy: "#0D1B33", gold: "#C8A15A", slate: "#4A6A80",
  border: "#E5E1D8", sunken: "#FAF8F4",
  urgent: "#B91C1C", urgentBg: "#FDF2F0", urgentBorder: "#F3D3CD",
  done: "#15803D", doneBg: "#EFF6F0", doneBorder: "#C8E0CD",
};

export default function PhotoCapture({ value, onChange, kind = "photo", label = "Add photo", tone = "neutral", disabled }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null); // local object URL, shown instantly
  const [signed, setSigned] = useState(null);   // resolved URL for a stored photo

  // Show a stored photo when the component mounts with an existing value.
  useEffect(() => {
    let alive = true;
    if (value && !preview) {
      fetch(`/api/photos?path=${encodeURIComponent(value)}`)
        .then((r) => r.json())
        .then((j) => { if (alive && j.url) setSigned(j.url); })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [value, preview]);

  // Release the object URL so the blob can be garbage collected.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = () => { if (!disabled && !busy) inputRef.current?.click(); };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    setError("");
    setPreview(URL.createObjectURL(file)); // instant feedback while it uploads
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", kind);
      const res = await fetch("/api/photos", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Upload failed.");
      onChange?.(json.path);
    } catch (err) {
      setError(err.message || "Upload failed.");
      setPreview(null);
    }
    setBusy(false);
  };

  const clear = () => { setPreview(null); setSigned(null); setError(""); onChange?.(null); };

  const shown = preview || signed;
  const accent = tone === "urgent" ? C.urgent : C.navy;
  const accentBorder = tone === "urgent" ? C.urgentBorder : C.border;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFile}
        style={{ display: "none" }}
      />

      {shown ? (
        <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${C.doneBorder}`, background: C.doneBg }}>
          <img
            src={shown}
            alt="Attached photo"
            style={{ display: "block", width: "100%", maxHeight: 190, objectFit: "cover", opacity: busy ? 0.6 : 1 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px" }}>
            <Icon name={busy ? "camera" : "checkCircle"} size={15} style={{ color: busy ? C.slate : C.done }} />
            <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: busy ? C.slate : C.done }}>
              {busy ? "Uploading…" : "Photo attached"}
            </span>
            {!busy && (
              <>
                <span onClick={pick} style={linkStyle}>Replace</span>
                <span onClick={clear} style={{ ...linkStyle, color: C.slate }}>Remove</span>
              </>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={pick}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 6, padding: "18px 12px", borderRadius: 10,
            border: `1.5px dashed ${accentBorder}`, background: C.sunken,
            cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1,
            minHeight: 44,
          }}
        >
          <Icon name="camera" size={22} style={{ color: accent }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: accent }}>{busy ? "Uploading…" : label}</span>
          <span style={{ fontSize: 10.5, color: C.slate }}>Take a photo or choose from your library</span>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: C.urgent }}>{error}</div>
      )}
    </div>
  );
}

const linkStyle = { fontSize: 11, fontWeight: 700, color: "#0D1B33", cursor: "pointer", padding: "2px 4px" };

// Read-only display of a stored photo — resolves the private path to a
// short-lived signed URL. Used where a photo is evidence rather than an input.
export function StoredPhoto({ path, height = 190 }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!path) return;
    fetch(`/api/photos?path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((j) => { if (alive) { if (j.url) setUrl(j.url); else setFailed(true); } })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [path]);

  if (failed) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: C.sunken, border: `1px solid ${C.border}` }}>
        <Icon name="warning" size={15} style={{ color: C.slate }} />
        <span style={{ fontSize: 11.5, color: C.slate }}>Photo unavailable</span>
      </div>
    );
  }
  if (!url) {
    return <div style={{ height, borderRadius: 10, background: C.sunken, border: `1px solid ${C.border}` }} />;
  }
  return (
    <img
      src={url}
      alt="Completion photo"
      style={{ display: "block", width: "100%", maxHeight: height, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.border}` }}
    />
  );
}
