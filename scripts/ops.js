// Operations helper — lets the project be configured from here instead of
// clicking through two dashboards.
//
// Reads tokens from .env.local (gitignored). Nothing is hardcoded and no token
// is ever printed.
//
//   node scripts/ops.js status                 what's configured / current state
//   node scripts/ops.js sql <file.sql>         run a migration against Supabase
//   node scripts/ops.js vercel-unprotect       make the deployment publicly reachable
//
const fs = require("fs");
const path = require("path");

const ENV = (() => {
  const p = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(p)) return {};
  return Object.fromEntries(
    fs.readFileSync(p, "utf8").split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
  );
})();

const need = (k) => {
  const v = ENV[k];
  if (!v) { console.error(`Missing ${k} in .env.local`); process.exit(1); }
  return v;
};
// Supabase project ref is the subdomain of the project URL.
const projectRef = () => new URL(need("NEXT_PUBLIC_SUPABASE_URL")).hostname.split(".")[0];

// ── Supabase Management API ───────────────────────────────────────────────────
// Runs real SQL, including DDL, which the anon/service keys cannot do.
async function runSql(sqlText) {
  const token = need("SUPABASE_ACCESS_TOKEN");
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef()}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sqlText }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Supabase SQL failed (${res.status}): ${body.slice(0, 400)}`);
  return body;
}

// ── Vercel REST API ───────────────────────────────────────────────────────────
async function vercel(pathname, init = {}) {
  const token = need("VERCEL_TOKEN");
  const team = ENV.VERCEL_TEAM_ID ? `${pathname.includes("?") ? "&" : "?"}teamId=${ENV.VERCEL_TEAM_ID}` : "";
  const res = await fetch(`https://api.vercel.com${pathname}${team}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Vercel ${init.method || "GET"} ${pathname} failed (${res.status}): ${body.slice(0, 400)}`);
  return body ? JSON.parse(body) : null;
}

const PROJECT = ENV.VERCEL_PROJECT || "fleming-app";

async function main() {
  const [cmd, arg] = process.argv.slice(2);

  if (cmd === "status") {
    console.log("supabase url        :", ENV.NEXT_PUBLIC_SUPABASE_URL ? "set" : "MISSING");
    console.log("supabase service key:", ENV.SUPABASE_SERVICE_ROLE_KEY ? "set" : "MISSING");
    console.log("supabase mgmt token :", ENV.SUPABASE_ACCESS_TOKEN ? "set — can run migrations" : "MISSING — cannot run SQL");
    console.log("vercel token        :", ENV.VERCEL_TOKEN ? "set — can change project settings" : "MISSING — cannot change Vercel");
    if (ENV.VERCEL_TOKEN) {
      try {
        const p = await vercel(`/v9/projects/${PROJECT}`);
        console.log("vercel project      :", p.name);
        console.log("sso protection      :", p.ssoProtection ? `ON (${p.ssoProtection.deploymentType})` : "off — publicly reachable");
      } catch (e) { console.log("vercel lookup failed:", e.message); }
    }
    return;
  }

  if (cmd === "sql") {
    if (!arg) { console.error("usage: node scripts/ops.js sql <file.sql>"); process.exit(1); }
    const file = path.isAbsolute(arg) ? arg : path.join(__dirname, "..", arg);
    const sqlText = fs.readFileSync(file, "utf8");
    console.log(`running ${path.basename(file)} (${sqlText.length} chars)…`);
    await runSql(sqlText);
    console.log("OK");
    return;
  }

  if (cmd === "vercel-unprotect") {
    // null clears Vercel Authentication, making the production site public.
    await vercel(`/v9/projects/${PROJECT}`, { method: "PATCH", body: JSON.stringify({ ssoProtection: null }) });
    const p = await vercel(`/v9/projects/${PROJECT}`);
    console.log("sso protection now  :", p.ssoProtection ? "STILL ON" : "off — publicly reachable");
    return;
  }

  console.log("commands: status | sql <file.sql> | vercel-unprotect");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
