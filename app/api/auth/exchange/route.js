// Exchanges a Supabase access token (obtained in the browser via magic link or
// Google sign-in) for the app's own httpOnly session cookie.
//
// The token is verified server-side against Supabase before any session is
// issued, so posting a made-up token here cannot log anyone in.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { supaSessionFromAccessToken } from "@/lib/auth/supabaseBackend";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });
  }
  const { accessToken } = await request.json().catch(() => ({}));
  const result = await supaSessionFromAccessToken(accessToken);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 401 });

  cookies().set(SESSION_COOKIE, result.token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
  return NextResponse.json({ user: result.user });
}
