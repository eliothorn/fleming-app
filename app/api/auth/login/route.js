import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { devLogin } from "@/lib/auth/devStore";
import { supaLogin } from "@/lib/auth/supabaseBackend";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(request) {
  const { email, password } = await request.json().catch(() => ({}));
  const result = isSupabaseConfigured()
    ? await supaLogin({ email, password })
    : devLogin({ email, password });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 401 });

  cookies().set(SESSION_COOKIE, result.token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
  return NextResponse.json({ user: result.user });
}
