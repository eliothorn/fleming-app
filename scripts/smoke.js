// Smoke test for the role-scoping boundary and the production-safety invariants.
//
// Role scoping in app/api/buildium/bootstrap/route.js is the security boundary:
// it decides, server-side, what each role's browser is allowed to receive. It had
// no automated cover, so a future refactor could widen it silently.
//
//   node scripts/smoke.js                                  # local, full run
//   node scripts/smoke.js https://your-app.vercel.app      # public-safety subset
//
// Against a deployed URL the role tests are skipped automatically: the
// @fleming.test accounts are locked out there by design (ALLOW_DEMO_ACCOUNTS),
// and that lockout is itself one of the things asserted.
//
// Exit code 0 = all passed, 1 = something failed.

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(BASE);
const PASSWORD = "demo1234";
const TIMEOUT_MS = 90_000; // a cold bootstrap pages ~30 throttled Buildium requests

const ACCOUNTS = {
  employee: "marcus@fleming.test",
  resident: "sarah@fleming.test",
  owner: "robert@fleming.test",
  vendor: "daflure@fleming.test",
  applicant: "jordan@fleming.test",
};

let passed = 0;
const failures = [];

function check(name, ok, detail = "") {
  if (ok) { passed++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function req(path, { method = "GET", body, cookie } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, setCookie: res.headers.get("set-cookie") || "" };
  } finally {
    clearTimeout(timer);
  }
}

async function login(email) {
  const res = await req("/api/auth/login", { method: "POST", body: { email, password: PASSWORD } });
  if (res.status !== 200) return null;
  const m = /fl_session=([^;]+)/.exec(res.setCookie);
  return m ? `fl_session=${m[1]}` : null;
}

const isEmpty = (v) => Array.isArray(v) && v.length === 0;

// ── The invariants that must hold no matter where this runs ───────────────────
async function publicSafety() {
  console.log(`\nProduction safety (${BASE})`);

  for (const role of ["employee", "owner"]) {
    const res = await req("/api/auth/login", {
      method: "POST",
      body: { email: ACCOUNTS[role], password: PASSWORD },
    });
    if (IS_LOCAL) {
      check(`demo ${role} CAN sign in locally (ALLOW_DEMO_ACCOUNTS)`, res.status === 200, `got ${res.status}`);
    } else {
      check(`demo ${role} is LOCKED OUT`, res.status === 401,
        res.status === 200 ? "PUBLISHED PASSWORD GRANTS REAL ACCESS" : `got ${res.status}`);
    }
  }

  const seed = await req("/api/auth/seed-demo", { method: "POST" });
  check("seed-demo endpoint is closed", seed.status === 403, `got ${seed.status}`);

  const anon = await req("/api/buildium/bootstrap");
  check("bootstrap rejects anonymous callers", anon.status === 401, `got ${anon.status}`);

  const anonInsp = await req("/api/inspections");
  check("inspections rejects anonymous callers", anonInsp.status === 401, `got ${anonInsp.status}`);

  // Occupancy maps tenant names onto unit numbers, so it must never be readable
  // without an employee session.
  const anonOcc = await req("/api/buildium/occupancy?propertyId=1");
  check("occupancy rejects anonymous callers", anonOcc.status === 401, `got ${anonOcc.status}`);
}

// ── Role scoping: what each role's browser is allowed to receive ──────────────
async function roleScoping() {
  console.log(`\nRole scoping (${BASE})`);
  const cookies = {};
  for (const [role, email] of Object.entries(ACCOUNTS)) {
    cookies[role] = await login(email);
    if (!cookies[role]) {
      check(`sign in as ${role}`, false, "could not authenticate — is ALLOW_DEMO_ACCOUNTS set?");
      return;
    }
  }

  const boot = {};
  for (const role of Object.keys(ACCOUNTS)) {
    const res = await req("/api/buildium/bootstrap", { cookie: cookies[role] });
    if (res.status !== 200 || !res.json) {
      check(`bootstrap loads for ${role}`, false, `got ${res.status}`);
      return;
    }
    boot[role] = res.json;
    check(`bootstrap loads for ${role}`, res.json.me?.role === role, `role came back as ${res.json.me?.role}`);
  }

  // Templates are employee-only.
  for (const role of ["resident", "owner", "vendor", "applicant"]) {
    check(`${role} receives no templates`, isEmpty(boot[role].templates));
  }

  // Portfolio data is staff/owner only.
  for (const role of ["resident", "vendor", "applicant"]) {
    check(`${role} receives no properties`, isEmpty(boot[role].properties));
    check(`${role} receives no balances`, isEmpty(boot[role].balances));
    check(`${role} receives no inspections`, isEmpty(boot[role].inspections));
  }

  // A resident must only ever receive their own work orders.
  const meR = boot.resident.me?.entity || {};
  const strayResident = (boot.resident.orders || []).filter((o) =>
    meR.tenantId != null && o.residentId != null ? o.residentId !== meR.tenantId : o.residentName !== meR.name
  );
  check("resident receives only their own orders", strayResident.length === 0,
    `${strayResident.length} order(s) belonging to someone else`);

  // A vendor must only ever receive work assigned to them.
  const meV = boot.vendor.me?.entity || {};
  const strayVendor = (boot.vendor.orders || []).filter((o) => o.vendorId !== meV.vendorId);
  check("vendor receives only their own orders", strayVendor.length === 0,
    `${strayVendor.length} order(s) assigned elsewhere`);

  check("applicant receives no orders", isEmpty(boot.applicant.orders));

  // Occupancy backs the staff work-order picker and exposes who lives where, so
  // only employees may read it. Employees are checked for reachability only —
  // asserting a unit count would tie the test to the broker's live portfolio.
  for (const role of ["resident", "owner", "vendor", "applicant"]) {
    const r = await req("/api/buildium/occupancy?propertyId=1", { cookie: cookies[role] });
    check(`${role} GET /api/buildium/occupancy → 403`, r.status === 403, `got ${r.status}`);
  }
  const empOcc = await req("/api/buildium/occupancy", { cookie: cookies.employee });
  check("employee occupancy without a property → 400", empOcc.status === 400, `got ${empOcc.status}`);

  // Property photos are served to the roles that see property cards only.
  for (const role of ["resident", "vendor", "applicant"]) {
    const r = await req("/api/buildium/property-image?propertyId=1", { cookie: cookies[role] });
    check(`${role} GET /api/buildium/property-image → 403`, r.status === 403, `got ${r.status}`);
  }
  // 200 with bytes when a photo exists, 404 when it doesn't — never a redirect
  // to Buildium's signed link, which expires in 302s and would render blank.
  const empImg = await req("/api/buildium/property-image?propertyId=24816", { cookie: cookies.employee });
  check("employee property-image → 200 or 404, not a redirect",
    empImg.status === 200 || empImg.status === 404, `got ${empImg.status}`);

  // Inspection reports are evidence: employees manage, owners read, residents nothing.
  const matrix = [
    ["resident", 403, 403],
    ["owner", 200, 403],
    ["employee", 200, 200],
  ];
  for (const [role, expectGet, expectPost] of matrix) {
    const g = await req("/api/inspections", { cookie: cookies[role] });
    check(`${role} GET /api/inspections → ${expectGet}`, g.status === expectGet, `got ${g.status}`);

    // Employees are allowed to create, so only probe the refusal for the others —
    // a real POST here would write a junk report into the live database.
    if (expectPost !== 200) {
      const p = await req("/api/inspections", {
        method: "POST", cookie: cookies[role], body: { property: "smoke-test — must be refused" },
      });
      check(`${role} POST /api/inspections → ${expectPost}`, p.status === expectPost, `got ${p.status}`);
    }
  }
}

async function main() {
  console.log(`Fleming smoke test → ${BASE}`);
  await publicSafety();
  if (IS_LOCAL) await roleScoping();
  else console.log("\nRole scoping: skipped (demo accounts are locked out on a deployed URL, as they should be)");

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("failed:");
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((e) => { console.error("smoke test errored:", e.message); process.exit(1); });
