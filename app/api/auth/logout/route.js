import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { devLogout } from "@/lib/auth/devStore";
import { supaLogout } from "@/lib/auth/supabaseBackend";

export async function POST() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    // Awaited: the session row must actually be deleted before we respond, or a
    // serverless instance can be frozen mid-flight leaving the session valid.
    if (isSupabaseConfigured()) await supaLogout(token);
    else devLogout(token);
  }
  cookies().delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
