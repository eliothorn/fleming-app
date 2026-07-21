import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { devLogout } from "@/lib/auth/devStore";
import { supaLogout } from "@/lib/auth/supabaseBackend";

export async function POST() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) (isSupabaseConfigured() ? supaLogout : devLogout)(token);
  cookies().delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
