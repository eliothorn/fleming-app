"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

// Real photo capture, with the choice of camera or library left to the person
// holding the phone.
//
// This was one input carrying `capture="environment"`, which on a phone opens
// the rear camera directly and never offers the library. A contractor who had
// already photographed the finished job could not attach that photo, which is
// how people actually work: they finish the job, photograph it, and open the
// app afterwards. Two inputs now back two buttons, one straight to the camera
// and one to the library. Desktop gets a file picker from either.
//
// Files upload immediately to /api/photos and the caller receives opaque
// storage paths, so a half-filled inspection never holds a large image in
// memory and the photos survive a page reload.
//
// `multiple` switches `value`/`onChange` from a single path to an array of
// paths, capped at `max`. Single mode is left as it was, because a checklist
// item documents one thing.

const C = {
  navy: "#0D1B33", gold: "#C8A15A", slate: "#4A6A80",
  border: "#E5E1D8", sunken: "#FAF8F4",
  urgent: "#B91C1C", urgentBg: "#FDF2F0", urgentBorder: "#F3D3CD",
  done: "#15803D", doneBg: "#EFF6F0", doneBorder: "#C8E0CD",
};

// Shrink on the phone before uploading. A modern phone photo is 3-8MB and
// Vercel refuses request bodies over 4.5MB, so without this most residents'
// photos failed with a bare "Upload failed". 1600px on the long edge at JPEG
// 0.82 is 200-600KB, plenty for a picture of a leak, and re-encoding through
// a canvas also turns iPhone HEIC into JPEG, which every viewer can show.
// If the browser cannot decode the file, the original is sent unchanged.
const MAX_EDGE = 1600;
async function shrink(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) return file;
    return new File([blob], (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

// `inset: 0` is Safari 14.1 and up; these run on whatever phone a contractor has.
const FILL = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 };

export default function PhotoCapture({
  value, onChange, kind = "photo", label = "Add photo",
  tone = "neutral", disabled, multiple = false, max = 6,
}) {
  const cameraRef = useRef(null);
  const libraryRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // path -> displayable url: a local object URL straight after upload (instant,
  // no round trip) or a signed URL for a photo stored in an earlier session.
  const [urls, setUrls] = useState({});
  // Files still in flight, so the count on screen is honest while they upload.
  const [queue, setQueue] = useState([]);

  // One prop serves both shapes. Tolerate either on the way in, so a caller
  // switching to `multiple` cannot strand a value it already held.
  const paths = (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean);
  const limit = multiple ? max : 1;

  // Object URLs have to be handed back or the blobs are never collected.
  const blobs = useRef(new Set());
  useEffect(() => () => { blobs.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  // Resolve anything with no URL yet: a stored photo from a previous session,
  // or a value the parent supplied itself. Keyed on the missing paths, so a
  // resolved URL shrinks the key rather than re-triggering its own fetch.
  const missing = paths.filter((p) => !urls[p]).join("\u0000");
  useEffect(() => {
    let alive = true;
    if (!missing) return;
    for (const p of missing.split("\u0000")) {
      fetch(`/api/photos?path=${encodeURIComponent(p)}`)
        .then((r) => r.json())
        .then((j) => { if (alive && j.url) setUrls((u) => (u[p] ? u : { ...u, [p]: j.url })); })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [missing]);

  const open = (ref) => { if (!disabled && !busy) ref.current?.click(); };

  const upload = async (file) => {
    const body = new FormData();
    body.append("file", await shrink(file));
    body.append("kind", kind);
    const res = await fetch("/api/photos", { method: "POST", body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.path) throw new Error(json.error || "Upload failed.");
    return json.path;
  };

  // Both buttons land here. Both inputs are disabled while this runs, so the
  // `paths` captured below cannot go stale underneath it.
  const onFiles = async (e) => {
    const chosen = Array.from(e.target.files || []);
    e.target.value = ""; // so the same file can be picked again
    if (!chosen.length) return;

    const room = Math.max(0, limit - paths.length);
    const files = multiple ? chosen.slice(0, room) : chosen.slice(0, 1);
    if (!files.length) { setError(`That is the limit of ${max} photos. Remove one to add another.`); return; }
    setError(chosen.length > files.length ? `Added the first ${files.length}; the limit is ${max}.` : "");

    const batch = files.map((file, i) => ({
      key: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      file, url: URL.createObjectURL(file),
    }));
    batch.forEach((b) => blobs.current.add(b.url));
    setQueue(batch.map(({ key, url }) => ({ key, url })));
    setBusy(true);

    // Sequential, not parallel: these are phone uploads over whatever signal is
    // in the basement, and three at once is how all three time out together.
    const added = [];
    let failure = "";
    for (const b of batch) {
      try {
        const path = await upload(b.file);
        added.push(path);
        setUrls((u) => ({ ...u, [path]: b.url }));
      } catch (err) {
        failure = err.message || "Upload failed.";
        URL.revokeObjectURL(b.url);
        blobs.current.delete(b.url);
      }
      setQueue((q) => q.filter((x) => x.key !== b.key));
    }

    setBusy(false);
    // Say what did land as well as what did not. A bare "Upload failed" on a
    // batch where two of three worked sends someone back to redo all three.
    if (failure) setError(added.length ? `${added.length} added. ${failure}` : failure);
    if (added.length) onChange?.(multiple ? [...paths, ...added] : added[0]);
  };

  const removeAt = (path) => {
    const u = urls[path];
    if (u && blobs.current.has(u)) { URL.revokeObjectURL(u); blobs.current.delete(u); }
    setUrls((prev) => { const n = { ...prev }; delete n[path]; return n; });
    setError("");
    const left = paths.filter((p) => p !== path);
    onChange?.(multiple ? left : left[0] || null);
  };

  const accent = tone === "urgent" ? C.urgent : C.navy;
  const accentBorder = tone === "urgent" ? C.urgentBorder : C.border;
  const atMax = paths.length >= limit;
  const empty = !paths.length && !queue.length;

  const btn = (primary) => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    flex: 1, minHeight: 44, padding: "9px 12px", borderRadius: 22,
    fontSize: 11.5, fontWeight: 700, fontFamily: "inherit",
    border: primary ? "none" : `1px solid ${C.border}`,
    background: primary ? accent : "#fff",
    color: primary ? "#fff" : accent,
    cursor: disabled || busy ? "default" : "pointer",
    opacity: disabled || busy ? 0.55 : 1,
  });

  // The two ways in, side by side. Neither is hidden behind the other, which
  // is the whole point of the change.
  const buttons = (
    <div style={{ display: "flex", gap: 8, width: "100%" }}>
      <button type="button" onClick={() => open(cameraRef)} disabled={disabled || busy} style={btn(true)}>
        <Icon name="camera" size={14} style={{ color: "#fff" }} />
        {busy ? "Uploading…" : "Take a photo"}
      </button>
      <button type="button" onClick={() => open(libraryRef)} disabled={disabled || busy} style={btn(false)}>
        {multiple ? "Choose photos" : "Choose a photo"}
      </button>
    </div>
  );

  return (
    <div>
      <input
        ref={cameraRef} type="file" accept="image/*" capture="environment"
        onChange={onFiles} style={{ display: "none" }}
      />
      {/* No `capture` on this one: it is the input that opens the library. */}
      <input
        ref={libraryRef} type="file" accept="image/*" multiple={multiple}
        onChange={onFiles} style={{ display: "none" }}
      />

      {empty ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 8, padding: "16px 12px", borderRadius: 10,
          border: `1.5px dashed ${accentBorder}`, background: C.sunken,
          opacity: disabled ? 0.55 : 1,
        }}>
          <Icon name="camera" size={22} style={{ color: accent }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: accent }}>{label}</span>
          <span style={{ fontSize: 10.5, color: C.slate, textAlign: "center", lineHeight: 1.45 }}>
            Take a new one, or choose {multiple ? "photos" : "a photo"} you already took.
          </span>
          {buttons}
        </div>
      ) : multiple ? (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 8 }}>
            {paths.map((p) => (
              <div key={p} style={{ position: "relative", paddingTop: "100%", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.doneBorder}`, background: C.sunken }}>
                {urls[p] && <img src={urls[p]} alt="Attached photo" style={{ ...FILL, width: "100%", height: "100%", objectFit: "cover" }} />}
                <span
                  onClick={() => removeAt(p)} role="button" aria-label="Remove this photo"
                  style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: "50%", background: "rgba(13,27,51,.78)", color: "#fff", fontSize: 14, fontWeight: 700, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                >×</span>
              </div>
            ))}
            {queue.map((q) => (
              <div key={q.key} style={{ position: "relative", paddingTop: "100%", borderRadius: 8, overflow: "hidden", border: `1px dashed ${C.border}`, background: C.sunken }}>
                <img src={q.url} alt="" style={{ ...FILL, width: "100%", height: "100%", objectFit: "cover", opacity: 0.45 }} />
                <span style={{ ...FILL, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: C.navy }}>Uploading…</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: atMax ? 0 : 8 }}>
            <Icon name={busy ? "camera" : "checkCircle"} size={15} style={{ color: busy ? C.slate : C.done }} />
            <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: busy ? C.slate : C.done }}>
              {busy ? "Uploading…" : `${paths.length} photo${paths.length === 1 ? "" : "s"} attached`}
            </span>
          </div>
          {atMax
            ? <div style={{ fontSize: 10.5, color: C.slate }}>That is the maximum of {max}. Remove one to add another.</div>
            : buttons}
        </div>
      ) : (
        <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${C.doneBorder}`, background: C.doneBg }}>
          <img
            src={urls[paths[0]] || queue[0]?.url}
            alt="Attached photo"
            style={{ display: "block", width: "100%", maxHeight: 190, objectFit: "cover", opacity: busy ? 0.6 : 1 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px" }}>
            <Icon name={busy ? "camera" : "checkCircle"} size={15} style={{ color: busy ? C.slate : C.done }} />
            <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: busy ? C.slate : C.done }}>
              {busy ? "Uploading…" : "Photo attached"}
            </span>
            {!busy && paths.length > 0 && (
              <>
                <span onClick={() => open(cameraRef)} style={linkStyle}>Retake</span>
                <span onClick={() => open(libraryRef)} style={linkStyle}>Replace</span>
                <span onClick={() => removeAt(paths[0])} style={{ ...linkStyle, color: C.slate }}>Remove</span>
              </>
            )}
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: C.urgent }}>{error}</div>
      )}
    </div>
  );
}

// Tall enough to hit on a phone; these were 11px text with 2px of padding.
const linkStyle = {
  fontSize: 11, fontWeight: 700, color: "#0D1B33", cursor: "pointer",
  padding: "11px 7px", minHeight: 40, display: "inline-flex", alignItems: "center",
};

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
