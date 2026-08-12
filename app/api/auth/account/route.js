// Delete your own account.
//
// Apple requires any app that lets you create an account to let you delete it
// from inside the app, not by emailing someone (App Review Guideline 5.1.1(v)).
// It is also just correct: someone who has moved out should be able to remove
// their sign-in without asking permission.
//
// What this deliberately does NOT do is touch Buildium. A resident deleting
// their app login is not cancelling their lease, closing their maintenance
// requests, or removing themselves from the broker's records — and an app that
// blurred those two things would be genuinely dangerous. The confirmation screen
// says so in as many words.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerUser, SESSION_COOKIE } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { getAdminSupabase } from "@/lib/auth/supabase";

const BUCKET = "fleming-photos";

export async function DELETE(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!isSupabaseConfigured()) {
    // Demo mode has no real accounts to delete; say so rather than pretending.
    return NextResponse.json({ error: "There's no real account to delete in demo mode." }, { status: 400 });
  }

  const admin = getAdminSupabase();

  // Their picture, which lives outside the database and so is not covered by any
  // cascade. Best-effort: a storage hiccup must not leave the account undeleted.
  try { await admin.storage.from(BUCKET).remove([`avatars/${me.id}`]); } catch { /* keep going */ }

  // Removing the auth user cascades to the profile and every session
  // (schema.sql and sessions.sql both declare ON DELETE CASCADE), and sets
  // inspections.performed_by to null — the inspection is a record about the
  // property and belongs to the office, so it survives; it just stops naming
  // someone who no longer exists.
  const { error } = await admin.auth.admin.deleteUser(me.id);
  if (error) {
    return NextResponse.json({ error: `Couldn't delete the account: ${error.message}` }, { status: 502 });
  }

  // Anything the account changed in Buildium stays in buildium_writes. That is
  // an audit trail of edits to the broker's own system, kept for the office
  // rather than about the person, and the privacy policy says so.

  cookies().set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return NextResponse.json({ ok: true });
}
