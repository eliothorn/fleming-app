import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { devSignup } from "@/lib/auth/devStore";
import { supaSignup } from "@/lib/auth/supabaseBackend";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(request) {
  const { email, password, name } = await request.json().catch(() => ({}));
  const result = isSupabaseConfigured()
    ? await supaSignup({ email, password, name })
    : devSignup({ email, password, name });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  cookies().set(SESSION_COOKIE, result.token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
  return NextResponse.json({ user: result.user });
}
