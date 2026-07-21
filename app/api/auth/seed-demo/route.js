// One-time: create the five role test accounts in Supabase (password demo1234)
// so every role can be demonstrated with a real login. Idempotent.
//
// GUARDED: only runs when ALLOW_DEMO_SEED=true is set in the environment, so this
// endpoint is inert in normal operation (the demo accounts are already seeded).
// Remove this route entirely before a public launch.
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { supaSignup } from "@/lib/auth/supabaseBackend";

const DEMO = [
  "marcus@fleming.test",
  "sarah@fleming.test",
  "robert@fleming.test",
  "daflure@fleming.test",
  "jordan@fleming.test",
];

export async function POST() {
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    return NextResponse.json({ error: "Seeding is disabled." }, { status: 403 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 400 });
  }
  const results = {};
  for (const email of DEMO) {
    const r = await supaSignup({ email, password: "demo1234", name: email.split("@")[0] });
    results[email] = r.error ? (/already/i.test(r.error) ? "exists" : r.error) : "created";
  }
  return NextResponse.json({ ok: true, results });
}
