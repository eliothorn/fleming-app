// Deployment readiness check. Employee-gated, read-only.
// Visit /api/deploy-check to see what still blocks a production launch.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { isSupabaseConfigured, isBuildiumConfigured, isBuildiumLive, isBuildiumWriteEnabled } from "@/lib/env";
import { sessionStorageMode, demoAccountsAllowed } from "@/lib/auth/supabaseBackend";
import { emailConfigured } from "@/lib/notify";
import { mapsConfigured } from "@/lib/geocode";

export async function GET(request) {
  const me = await getServerUser(request);
  if (!me || me.role !== "employee") {
    return NextResponse.json({ error: "Employees only." }, { status: 403 });
  }

  const checks = [];
  const add = (name, ok, detail, blocking = false) => checks.push({ name, ok, blocking, detail });

  const sessions = sessionStorageMode();
  add(
    "Session storage",
    sessions === "database",
    sessions === "database"
      ? "Sessions persist in app_sessions — safe across serverless instances."
      : "IN-MEMORY FALLBACK. Run supabase/sessions.sql, or users will be logged out at random in production.",
    sessions !== "database"
  );

  add("Supabase auth", isSupabaseConfigured(), isSupabaseConfigured() ? "Configured." : "Missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY.", !isSupabaseConfigured());

  add("Buildium reads", isBuildiumConfigured(), isBuildiumConfigured() ? `Keys present. Live mode: ${isBuildiumLive()}` : "No Buildium keys.", false);

  add(
    "Buildium writes",
    true,
    isBuildiumWriteEnabled()
      ? "ENABLED — the app can create/update real tickets."
      : "Disabled. Residents' requests do NOT reach the office; the UI says so.",
    false
  );

  const seedOpen = process.env.ALLOW_DEMO_SEED === "true";
  add("Demo seeding endpoint", !seedOpen, seedOpen ? "OPEN — /api/auth/seed-demo can create accounts. Unset ALLOW_DEMO_SEED." : "Disabled.", seedOpen);

  // The seeded @fleming.test accounts share one published password and hold
  // employee/owner roles, so on a public URL they are an open door to real
  // tenant data.
  const demoOpen = demoAccountsAllowed();
  add(
    "Demo accounts (@fleming.test)",
    !demoOpen,
    demoOpen
      ? "ENABLED — marcus@fleming.test (employee) and robert@fleming.test (owner) can sign in with the published password 'demo1234'. Do not ship with ALLOW_DEMO_ACCOUNTS set."
      : "Locked out. They remain in the database but cannot sign in.",
    demoOpen
  );

  add(
    "Session secret quality",
    true,
    "Tokens are 32 random bytes from crypto.randomBytes.",
    false
  );

  // These three were built, verified locally, and then sat dead in production
  // for days because their keys were only ever put in .env.local. A feature that
  // fails soft is worse than one that fails loudly — nothing in the UI said the
  // email had gone nowhere. This is where that gets caught next time.
  const mail = emailConfigured();
  add(
    "Transactional email (Resend)",
    mail,
    mail
      ? `Configured. Sending as noreply@${process.env.RESEND_DOMAIN}.`
      : "NOT configured — inspection reports, owner reports and vendor-assignment notices silently send nothing. Set RESEND_API_KEY and RESEND_DOMAIN.",
    false
  );

  const reportTo = process.env.INSPECTION_REPORT_TO || "";
  add(
    "Inspection report recipient",
    Boolean(reportTo),
    reportTo
      ? `Finished reports go to ${reportTo}, plus the property's owner.`
      : "Not set — an employee must type a recipient on every report. Set INSPECTION_REPORT_TO.",
    false
  );

  const maps = mapsConfigured();
  add(
    "Map geocoding (Google)",
    maps,
    maps
      ? "Configured. Key is server-side only and never reaches the browser."
      : "NOT configured — the map screen can place no properties. Set GOOGLE_MAPS_API_KEY.",
    false
  );

  // Caches and the Buildium rate-limit queue are per-instance. Several warm
  // serverless instances could collectively exceed Buildium's 10 req/s.
  add(
    "Buildium rate limiting",
    true,
    "Throttle queue is per-instance. Fine at low traffic; needs a shared limiter if many instances run concurrently.",
    false
  );

  const blockers = checks.filter((c) => c.blocking);
  return NextResponse.json({
    readyToDeploy: blockers.length === 0,
    blockers: blockers.map((b) => b.name),
    checks,
  });
}
