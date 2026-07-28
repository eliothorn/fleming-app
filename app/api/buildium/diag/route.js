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
  const params = new URL(request.url).searchParams;
  const testEmail = params.get("email");
  if (testEmail) {
    return NextResponse.json({ email: testEmail, match: await matchByEmail(testEmail) });
  }

  // Will a real resident actually see their own orders? A task's residentName comes
  // from RequestedByUserEntity; a matched resident's name comes from the tenant
  // record. If those don't agree, every resident logs in to an empty app.
  // /diag?residentmatch=1
  if (params.get("residentmatch")) {
    const { buildium } = await import("@/lib/buildium");
    const orders = await buildium().listOrders();
    const tenants = [];
    for (let i = 0; i < 25; i++) {
      const page = await buildiumRequest("/leases/tenants", { query: { limit: 100, offset: i * 100 } });
      if (!Array.isArray(page) || !page.length) break;
      tenants.push(...page);
      if (page.length < 100) break;
    }
    const tenantNames = new Set(
      tenants.map((t) => [t.FirstName, t.LastName].filter(Boolean).join(" ").trim().toLowerCase()).filter(Boolean)
    );
    const named = orders.filter((o) => o.residentName);
    const matched = named.filter((o) => tenantNames.has(String(o.residentName).trim().toLowerCase()));
    // Is there a stable requestor ID we could scope on instead of a name string?
    const rawTasks = [];
    for (let i = 0; i < 5; i++) {
      const page = await buildiumRequest("/tasks", { query: { limit: 100, offset: i * 100 } });
      if (!Array.isArray(page) || !page.length) break;
      rawTasks.push(...page);
      if (page.length < 100) break;
    }
    const residentReqs = rawTasks.filter((t) => String(t.TaskType) === "ResidentRequest");
    const tenantIds = new Set(tenants.map((t) => t.Id));
    const withReqId = residentReqs.filter((t) => t.RequestedByUserEntity?.Id != null);
    return NextResponse.json({
      residentRequestTasks: residentReqs.length,
      withRequestorId: withReqId.length,
      requestorIdIsAKnownTenantId: withReqId.filter((t) => tenantIds.has(t.RequestedByUserEntity.Id)).length,
      requestorTypes: [...new Set(residentReqs.map((t) => t.RequestedByUserEntity?.Type))],
      totalOrders: orders.length,
      ordersWithResidentName: named.length,
      ordersWhoseResidentIsAKnownTenant: matched.length,
      tenantsIndexed: tenantNames.size,
      unmatchedSample: named.filter((o) => !tenantNames.has(String(o.residentName).trim().toLowerCase())).slice(0, 8).map((o) => o.residentName),
      matchedSample: matched.slice(0, 8).map((o) => o.residentName),
    });
  }

  // Simulate a real resident's scoped order list without creating any account:
  // match a real tenant email -> identity, then apply the same filter bootstrap uses.
  // /diag?residentsim=1
  if (params.get("residentsim")) {
    const { buildium } = await import("@/lib/buildium");
    const orders = await buildium().listOrders();
    const tenants = [];
    for (let i = 0; i < 25; i++) {
      const page = await buildiumRequest("/leases/tenants", { query: { limit: 100, offset: i * 100 } });
      if (!Array.isArray(page) || !page.length) break;
      tenants.push(...page);
      if (page.length < 100) break;
    }
    const tenantsById = new Map(tenants.map((t) => [t.Id, t]));
    const byResident = new Map();
    for (const o of orders) if (o.residentId != null) byResident.set(o.residentId, (byResident.get(o.residentId) || 0) + 1);
    const known = [...byResident.entries()].filter(([id]) => tenantsById.has(id));
    const withEmail = known.filter(([id]) => tenantsById.get(id).Email);

    // End-to-end: take one such tenant, run the real matcher, apply bootstrap's filter.
    let sim = null;
    if (withEmail.length) {
      const [tid, expected] = withEmail[0];
      const email = tenantsById.get(tid).Email;
      const m = await matchByEmail(email);
      const myId = m?.entity?.tenantId;
      const myName = m?.entity?.name;
      const visible = orders.filter((o) =>
        myId != null && o.residentId != null ? o.residentId === myId : Boolean(myName) && o.residentName === myName
      );
      sim = {
        matchedRole: m?.role,
        matchedUnit: m?.entity?.unit,
        matchedAddress: m?.entity?.address,
        tenantIdOnIdentity: myId ?? null,
        ordersExpected: expected,
        ordersVisibleToThem: visible.length,
        works: visible.length === expected && expected > 0,
      };
    }
    return NextResponse.json({
      distinctResidentsOnOrders: byResident.size,
      ofThoseKnownTenants: known.length,
      ofThoseWithEmailSoCouldSignUp: withEmail.length,
      simulation: sim,
    });
  }

  // Verify the WRITE path without writing: confirm the resident-request endpoint
  // family exists (via GET on the same path a POST/PUT would use), and show the
  // exact payload a create would send. /diag?writecheck=1
  if (params.get("writecheck")) {
    const { realBuildium, writesEnabled } = await import("@/lib/buildium/real");
    const out = { writesEnabled: writesEnabled(), pathProbe: {}, dryRunCreate: null, dryRunUpdate: null };

    // Find a real ResidentRequest to probe the type-specific path with a GET.
    const tasks = await buildiumRequest("/tasks", { query: { limit: 100 } });
    const rr = (Array.isArray(tasks) ? tasks : []).find((t) => String(t.TaskType) === "ResidentRequest");
    out.sampleResidentRequestId = rr?.Id ?? null;
    if (rr?.Id != null) {
      for (const p of ["/tasks/residentrequests", "/tasks/todorequests"]) {
        try {
          const got = await buildiumRequest(`${p}/${rr.Id}`);
          out.pathProbe[p] = { ok: true, returnedId: got?.Id ?? null };
        } catch (e) {
          out.pathProbe[p] = { ok: false, error: String(e.message || e).slice(0, 160) };
        }
      }
    }

    // Build (not send) the payloads. With writes disabled these return previews.
    try {
      out.dryRunCreate = await realBuildium.createOrder({
        title: "DIAGNOSTIC — not sent",
        notes: "Payload preview only.",
        status: "pending",
        leaseId: 999999,
        residentId: 888888,
      });
    } catch (e) { out.dryRunCreate = { error: String(e.message || e) }; }

    if (rr?.Id != null) {
      try {
        out.dryRunUpdate = await realBuildium.updateOrder(`WO-${rr.Id}`, { status: "done" });
      } catch (e) { out.dryRunUpdate = { error: String(e.message || e) }; }
    }
    return NextResponse.json(out);
  }

  // Which email providers do real tenants/owners/vendors use? This decides
  // whether "Sign in with Google/Apple" can actually match someone to their
  // Buildium record, or would just strand them as unmatched. /diag?emaildomains=1
  if (params.get("emaildomains")) {
    const grab = async (path, field) => {
      const out = [];
      for (let i = 0; i < 25; i++) {
        const page = await buildiumRequest(path, { query: { limit: 100, offset: i * 100 } });
        if (!Array.isArray(page) || !page.length) break;
        out.push(...page.map((r) => r[field]).filter(Boolean));
        if (page.length < 100) break;
      }
      return out;
    };
    const [tenants, owners, vendors] = await Promise.all([
      grab("/leases/tenants", "Email"),
      grab("/rentals/owners", "Email"),
      grab("/vendors", "PrimaryEmail"),
    ]);
    const tally = (emails) => {
      const d = {};
      for (const e of emails) {
        const dom = String(e).toLowerCase().split("@")[1];
        if (dom) d[dom] = (d[dom] || 0) + 1;
      }
      const sorted = Object.entries(d).sort((a, b) => b[1] - a[1]);
      const consumer = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com", "me.com", "live.com", "comcast.net", "msn.com", "verizon.net"];
      const googleBacked = sorted.filter(([x]) => x === "gmail.com").reduce((n, [, c]) => n + c, 0);
      const appleBacked = sorted.filter(([x]) => ["icloud.com", "me.com", "mac.com"].includes(x)).reduce((n, [, c]) => n + c, 0);
      const consumerTotal = sorted.filter(([x]) => consumer.includes(x)).reduce((n, [, c]) => n + c, 0);
      return { total: emails.length, distinctDomains: sorted.length, top: sorted.slice(0, 8), googleBacked, appleBacked, consumerTotal };
    };
    return NextResponse.json({ tenants: tally(tenants), owners: tally(owners), vendors: tally(vendors) });
  }

  // Distribution of task types/categories/statuses, to decide what counts as a
  // real maintenance work order: /diag?breakdown=1
  if (params.get("breakdown")) {
    const tally = (arr, key) => arr.reduce((m, x) => { const k = key(x) ?? "(none)"; m[k] = (m[k] || 0) + 1; return m; }, {});
    const all = [];
    for (let i = 0; i < 5; i++) {
      const page = await buildiumRequest("/tasks", { query: { limit: 100, offset: i * 100 } });
      if (!Array.isArray(page) || !page.length) break;
      all.push(...page);
      if (page.length < 100) break;
    }
    const wo = all.find((t) => String(t.TaskType) === "ResidentRequest");
    return NextResponse.json({
      total: all.length,
      byTaskType: tally(all, (t) => t.TaskType),
      byCategory: tally(all, (t) => t.Category?.Name),
      byStatus: tally(all, (t) => t.TaskStatus),
      byPriority: tally(all, (t) => t.Priority),
      // How do real work orders reference their property/unit?
      propertyShapes: tally(all.filter((t) => String(t.TaskType) === "ResidentRequest"), (t) => (t.Property == null ? "Property:null" : typeof t.Property)),
      workOrderSample: wo && { Id: wo.Id, TaskType: wo.TaskType, Property: wo.Property, UnitId: wo.UnitId, UnitNumber: wo.UnitNumber, Title: wo.Title },
    });
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
