// Match a signup/login email to a real Buildium identity (tenant / owner /
// vendor / brokerage staff) so people are assigned the right role and see their
// own data.
//
// Buildium's list endpoints don't filter by email, so we build a small in-memory
// directory (email -> identity) once and cache it briefly. Matching happens only
// on signup and on login for still-unmatched users, so this stays cheap.

import { buildiumRequest } from "./real";
import { isBuildiumLive } from "../env";

const TTL_MS = 5 * 60 * 1000;
const PAGE = 100;
const MAX_PAGES = 25; // safety cap (~2500 records per resource)

function cache() {
  return (globalThis.__flBuildiumDir ||= { at: 0, byEmail: null });
}

async function pageThrough(path) {
  const all = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const batch = await buildiumRequest(path, { query: { limit: PAGE, offset: i * PAGE } });
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  return all;
}

function bestLease(leases = []) {
  if (!leases.length) return null;
  const active = leases.filter((l) => l.LeaseStatus === "Active");
  const pool = active.length ? active : leases;
  return pool.slice().sort((a, b) => String(b.LeaseFromDate || "").localeCompare(String(a.LeaseFromDate || "")))[0];
}

async function buildDirectory() {
  const byEmail = new Map();
  const add = (email, identity) => {
    const e = String(email || "").trim().toLowerCase();
    if (e && !byEmail.has(e)) byEmail.set(e, identity);
  };

  const [rentals, tenants, owners, vendors, users] = await Promise.all([
    pageThrough("/rentals"), pageThrough("/leases/tenants"), pageThrough("/rentals/owners"), pageThrough("/vendors"),
    // Brokerage staff. Without these, nobody who actually works at the office
    // could get the employee view — they signed in and landed as an unmatched
    // resident looking at a blank screen, which is what the broker himself
    // would have hit with his everyday address.
    pageThrough("/users"),
  ]);
  const propName = new Map(rentals.map((r) => [r.Id, r.Name || r.Address?.AddressLine1 || "Property"]));

  for (const t of tenants) {
    const name = [t.FirstName, t.LastName].filter(Boolean).join(" ") || "Resident";
    const lease = bestLease(t.Leases);
    const identity = {
      role: "resident",
      entity: {
        name,
        // Buildium tenant id — used to scope this resident's own work orders by id
        // rather than by matching name strings.
        tenantId: t.Id,
        // Lease ("unit agreement") id — REQUIRED by Buildium to file a resident
        // request on their behalf, so it must ride along with the identity.
        leaseId: lease?.Id ?? null,
        unit: lease?.UnitNumber ? `Unit ${lease.UnitNumber}` : "Pending assignment",
        address: lease?.PropertyId ? (propName.get(lease.PropertyId) || "—") : "—",
        // Real lease facts, so the app never invents them. Anything Buildium
        // doesn't give us stays null and the UI shows "—" rather than a guess.
        leaseEnd: lease?.LeaseToDate || null,
        leaseStatus: lease?.LeaseStatus || null,
        rent: Number(lease?.AccountDetails?.Rent) || null,
      },
    };
    add(t.Email, identity);
    add(t.AlternateEmail, identity);
  }
  for (const o of owners) {
    const name = o.CompanyName || [o.FirstName, o.LastName].filter(Boolean).join(" ") || "Owner";
    const identity = { role: "owner", entity: { name, sub: "Portfolio Owner" } };
    add(o.Email, identity);
    add(o.AlternateEmail, identity);
  }
  for (const v of vendors) {
    const name = v.CompanyName || [v.FirstName, v.LastName].filter(Boolean).join(" ") || "Vendor";
    add(v.PrimaryEmail, { role: "vendor", entity: { name, vendorId: v.Id, sub: v.Category?.Name || "Vendor" } });
  }

  // Staff LAST on purpose. add() keeps the first identity it sees for an
  // address, so anyone who is also a tenant, owner or vendor keeps that
  // narrower role rather than being handed the employee view — which sees every
  // property, every resident and every balance — because they happen to share an
  // address with a staff record.
  for (const u of users) {
    // /users also contains RentalOwner logins; only actual staff work here.
    if (!Array.isArray(u.UserTypes) || !u.UserTypes.includes("Staff")) continue;
    // A deactivated account is someone who has left. They must not keep access
    // to the portfolio through this app after losing it in Buildium.
    if (u.IsActive === false) continue;
    const name = [u.FirstName, u.LastName].filter(Boolean).join(" ") || u.Email || "Staff";
    const identity = {
      role: "employee",
      entity: { name, sub: u.CompanyName || "Property Management", staffId: u.Id },
    };
    add(u.Email, identity);
    add(u.AlternateEmail, identity);
  }

  return byEmail;
}

// Returns { role, entity } for a known email, or null. No-op unless Buildium live.
export async function matchByEmail(email) {
  if (!isBuildiumLive()) return null;
  const c = cache();
  const fresh = c.byEmail && Date.now() - c.at < TTL_MS;
  if (!fresh) {
    try { c.byEmail = await buildDirectory(); c.at = Date.now(); }
    catch { return null; } // matching is best-effort; never block signup/login
  }
  return c.byEmail.get(String(email || "").trim().toLowerCase()) || null;
}
