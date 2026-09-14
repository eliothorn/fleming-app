// Photo upload + retrieval for inspections and vendor completions.
//
// The bucket is PRIVATE and the storage key is server-only, so the browser never
// touches Supabase Storage directly — it posts here and gets back an opaque
// path. Reads go through a short-lived signed URL, so a leaked path alone is not
// enough to view someone's unit.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { getAdminSupabase } from "@/lib/auth/supabase";

const BUCKET = "fleming-photos";
// Vercel rejects request bodies over 4.5MB before this code runs, so a higher
// limit here was a promise the platform could not keep. PhotoCapture shrinks
// on the device to a few hundred KB; this is the ceiling for anything that
// slips past that.
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// Who may attach which kind of photo. A resident documents the problem they
// are reporting; staff and contractors document inspections and finished
// work. A resident may not upload under a staff kind, and nobody uploads
// under a kind the app does not use.
const KINDS_BY_ROLE = {
  employee: new Set(["inspection", "completion", "request", "photo"]),
  vendor: new Set(["completion", "photo"]),
  resident: new Set(["request"]),
};

export const maxDuration = 60;

// POST: multipart/form-data with `file` and `kind` (inspection|completion|request)
export async function POST(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const allowedKinds = KINDS_BY_ROLE[me.role];
  if (!allowedKinds) {
    return NextResponse.json({ error: "Not permitted to upload photos." }, { status: 403 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Photo storage needs Supabase configured." }, { status: 400 });
  }

  let form;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: "Expected a file upload." }, { status: 400 }); }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No photo was included." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That photo is too large to send. Try taking it again from inside the app." }, { status: 413 });
  }
  const type = file.type || "image/jpeg";
  if (!ALLOWED.includes(type)) {
    return NextResponse.json({ error: `Unsupported image type (${type}).` }, { status: 415 });
  }

  const kind = String(form.get("kind") || "photo").replace(/[^a-z]/gi, "").slice(0, 20) || "photo";
  if (!allowedKinds.has(kind)) {
    return NextResponse.json({ error: "Not permitted to upload that kind of photo." }, { status: 403 });
  }
  const ext = (type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  // Path carries who/what/when so photos remain traceable without a lookup.
  const path = `${kind}/${me.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await getAdminSupabase()
    .storage.from(BUCKET)
    .upload(path, bytes, { contentType: type, upsert: false });

  if (error) {
    return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 502 });
  }
  return NextResponse.json({ path, size: bytes.length, type });
}

// GET ?path=... → short-lived signed URL for displaying a stored photo.
export async function GET(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const path = new URL(request.url).searchParams.get("path");
  if (!path || path.includes("..")) return NextResponse.json({ error: "Missing path." }, { status: 400 });

  // Stored photos are pictures of the inside of people's homes. Staff,
  // owners and contractors may view them (owners' lists are already narrowed
  // to their properties); a resident may view only the photos they uploaded
  // themselves, which the path records. An account anyone can create on the
  // public site (a pending, unmatched resident) gets nothing.
  const ownRequestPhoto = me.role === "resident" && path.startsWith(`request/${me.id}/`);
  const viewerRole = ["employee", "owner", "vendor"].includes(me.role) && me.matched;
  if (!viewerRole && !ownRequestPhoto) {
    return NextResponse.json({ error: "Not permitted." }, { status: 403 });
  }

  const { data, error } = await getAdminSupabase()
    .storage.from(BUCKET)
    .createSignedUrl(path, 60 * 10); // 10 minutes

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Could not load that photo." }, { status: 404 });
  }
  return NextResponse.json({ url: data.signedUrl });
}
