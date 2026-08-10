// A profile picture, for any account.
//
// Stored at a deterministic path — avatars/{userId} — so nothing new has to be
// recorded in the database. Whether someone has a picture is answered by whether
// that object exists, which means no migration and no column that can drift out
// of step with the file.
//
// The bucket stays private. The image is streamed back through this route rather
// than handed out as a storage URL, so a picture of a real resident is never
// reachable by anyone who isn't signed in.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { getAdminSupabase } from "@/lib/auth/supabase";

const BUCKET = "fleming-photos";
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const pathFor = (userId) => `avatars/${userId}`;

// POST: multipart/form-data with `file`. Replaces whatever was there.
export async function POST(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
    return NextResponse.json({ error: "That photo is larger than 8MB — most phones can shrink it." }, { status: 413 });
  }
  const type = file.type || "image/jpeg";
  if (!ALLOWED.includes(type)) {
    return NextResponse.json({ error: `Unsupported image type (${type}).` }, { status: 415 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  // upsert, because this is "my picture" rather than an append-only record.
  const { error } = await getAdminSupabase()
    .storage.from(BUCKET)
    .upload(pathFor(me.id), bytes, { contentType: type, upsert: true });

  if (error) return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 502 });
  return NextResponse.json({ ok: true, updatedAt: Date.now() });
}

// DELETE: remove it again.
export async function DELETE(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await getAdminSupabase().storage.from(BUCKET).remove([pathFor(me.id)]);
  return NextResponse.json({ ok: true });
}

// GET ?userId=... → the image itself, or 404 when there isn't one.
//
// Any signed-in user may fetch another's picture: an employee needs to see who
// reported a job, and a resident sees who is attending. It is a profile picture,
// shown next to a name the viewer can already see — but it is still gated behind
// a session so it never becomes a public URL.
export async function GET(request) {
  const me = await getServerUser(request);
  if (!me) return new NextResponse("Not authenticated", { status: 401 });

  // Whitelist rather than blocklist: no slashes and no dots, so a crafted id can
  // never walk out of the avatars/ prefix into someone's inspection photos.
  const asked = new URL(request.url).searchParams.get("userId");
  const userId = asked && /^[A-Za-z0-9_-]{1,64}$/.test(asked) ? asked : me.id;

  // Most accounts will never set a picture, and the header asks on every screen.
  // Caching the "no" as well as the "yes" keeps that from becoming a request per
  // navigation. Both are short, and the caller busts them with ?v= on change.
  const missing = () =>
    new NextResponse("No picture", { status: 404, headers: { "Cache-Control": "private, max-age=60" } });

  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(pathFor(userId), 60);
    if (error || !data?.signedUrl) return missing();

    const res = await fetch(data.signedUrl, { cache: "no-store" });
    if (!res.ok) return missing();

    return new NextResponse(await res.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return missing();
  }
}
