// DEMO-ONLY: swap the current session to a seeded role account so one person can
// walk a client through all five roles. Disabled automatically once Supabase is
// configured (real users have exactly one role, set by their Buildium record).
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { devViewAs } from "@/lib/auth/devStore";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(request) {
  if (isSupabaseConfigured()) {
    return NextResponse.json({ error: "Role switching is disabled in live mode." }, { status: 403 });
  }
  const { role } = await request.json().catch(() => ({}));
  const result = devViewAs(role);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  cookies().set(SESSION_COOKIE, result.token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
  return NextResponse.json({ user: result.user });
}
