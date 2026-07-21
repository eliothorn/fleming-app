// Buildium connection diagnostic. Safe: read-only, employee-gated, fetches a tiny
// sample so we can (a) confirm the keys work and (b) inspect the real field shapes
// before flipping the live UI on. Visit /api/buildium/_diag while logged in as the
// employee once keys are in .env.local.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { isBuildiumConfigured, isBuildiumLive } from "@/lib/env";
import { buildiumRequest } from "@/lib/buildium/real";
import { matchByEmail } from "@/lib/buildium/matcher";

export async function GET(request) {
  const me = await getServerUser(request);
  if (!me || me.role !== "employee") {
    return NextResponse.json({ error: "Log in as the employee to run diagnostics." }, { status: 403 });
  }

  // Test the email→Buildium matcher without creating an account: /diag?email=...
  const testEmail = new URL(request.url).searchParams.get("email");
  if (testEmail) {
    return NextResponse.json({ email: testEmail, match: await matchByEmail(testEmail) });
  }
  if (!isBuildiumConfigured()) {
    return NextResponse.json({
      configured: false,
      live: false,
      message: "No Buildium keys detected. Add BUILDIUM_CLIENT_ID and BUILDIUM_CLIENT_SECRET to .env.local and restart.",
    });
  }

  // Probe a few read endpoints independently so partial failures are visible.
  const probes = { rentals: "/rentals", tasks: "/tasks", vendors: "/vendors", tenants: "/leases/tenants", owners: "/rentals/owners", leases: "/leases" };
  const samples = {};
  for (const [name, path] of Object.entries(probes)) {
    try {
      const data = await buildiumRequest(path, { query: { limit: 2 } });
      samples[name] = { ok: true, count: Array.isArray(data) ? data.length : null, sample: Array.isArray(data) ? data.slice(0, 1) : data };
    } catch (e) {
      samples[name] = { ok: false, error: String(e.message || e) };
    }
  }

  return NextResponse.json({
    configured: true,
    live: isBuildiumLive(),
    baseUrl: process.env.BUILDIUM_BASE_URL || "https://api.buildium.com/v1",
    note: isBuildiumLive()
      ? "Live mode ON — the app is serving real Buildium data."
      : "Keys detected, live mode OFF (safe). Set BUILDIUM_LIVE=true after mappings are confirmed.",
    samples,
  });
}
