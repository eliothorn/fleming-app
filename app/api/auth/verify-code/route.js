// Completes a sign-in with the one-time code from the email, instead of the link.
//
// Why this exists: inside the App Store / Play build the emailed link opens in
// Safari or Chrome, whose cookies are not the app's, so the app itself stays
// signed out. The same email carries the code (supabase/email-templates/
// magic-link.html), and typing it here finishes sign-in without leaving the
// WebView. The code is the same one-time credential as the link: Supabase
// checks it, burns it, and hands back a session, which then goes through the
// exact path a clicked link takes (supaSessionFromAccessToken), so the demo
// lockout, Buildium matching and employee re-check all apply unchanged.
//
// Brute force: Supabase rate-limits verification attempts per address and the
// code expires with the link, so an 8-digit code cannot usefully be guessed.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getAnonSupabase } from "@/lib/auth/supabase";
import { supaSessionFromAccessToken } from "@/lib/auth/supabaseBackend";
import { SESSION_COOKIE } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Code sign-in needs Supabase configured." }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const code = String(body.code || "").replace(/\D/g, "");
  if (!email || code.length < 6) {
    return NextResponse.json({ error: "Enter the code from the email." }, { status: 400 });
  }

  const { data, error } = await getAnonSupabase().auth.verifyOtp({ email, token: code, type: "email" });
  if (error || !data?.session?.access_token) {
    // Supabase's own wording leaks nothing useful and confuses people
    // ("Token has expired or is invalid"); say what to actually do.
    return NextResponse.json({ error: "That code didn't work. Check the digits, or request a new email — codes only last an hour." }, { status: 401 });
  }

  const result = await supaSessionFromAccessToken(data.session.access_token);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 401 });

  cookies().set(SESSION_COOKIE, result.token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
  return NextResponse.json({ user: result.user });
}
