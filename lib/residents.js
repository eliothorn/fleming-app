// The resident roster: who can actually be invited to the app.
//
// This is deliberately not the matcher's directory. That one answers "which
// identity owns this email address" and is keyed by email; this one answers
// "who should we email next", which needs the people WITHOUT an address too,
// because 91 of them is a number the office has to act on rather than a number
// to quietly drop.
//
// Only CURRENT residents. Buildium returns a tenant's whole lease history, and
// emailing a former tenant an invitation to their old building is the kind of
// mistake that ends a rollout on day one.
import { buildiumRequest } from "./buildium/real.js";

const PAGE = 100;
const MAX_PAGES = 25; // ~2,500 records, the same cap the matcher uses
const TTL_MS = 5 * 60 * 1000;

function cache() {
  return (globalThis.__flResidentRoster ||= { at: 0, value: null });
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

const emailOf = (v) => {
  const e = String(v || "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : null;
};

// A resident is current if they hold an Active lease. Anything else is history.
const activeLease = (leases = []) =>
  leases.find((l) => l.LeaseStatus === "Active") || null;

// Everyone on an active lease, with the property they live at. Cached briefly:
// the roster is five paged Buildium calls and the rollout screen re-reads it on
// every visit.
export async function residentRoster({ fresh = false } = {}) {
  const c = cache();
  if (!fresh && c.value && Date.now() - c.at < TTL_MS) return c.value;

  const [rentals, tenants] = await Promise.all([
    pageThrough("/rentals"),
    pageThrough("/leases/tenants"),
  ]);
  const propName = new Map(rentals.map((r) => [r.Id, r.Name || r.Address?.AddressLine1 || "Property"]));

  // One row per person, not per lease. Somebody on two active leases is still
  // one human with one inbox, and two invitations reads as a broken system.
  const byKey = new Map();
  let withoutEmail = 0;

  for (const t of tenants) {
    const lease = activeLease(t.Leases);
    if (!lease) continue; // former tenant

    const email = emailOf(t.Email) || emailOf(t.AlternateEmail);
    if (!email) { withoutEmail++; continue; }
    if (byKey.has(email)) continue;

    byKey.set(email, {
      email,
      tenantId: t.Id,
      leaseId: lease.Id ?? null,
      name: [t.FirstName, t.LastName].filter(Boolean).join(" ") || "Resident",
      unit: lease.UnitNumber ? `Unit ${lease.UnitNumber}` : null,
      propertyId: lease.PropertyId ?? null,
      property: lease.PropertyId ? propName.get(lease.PropertyId) || "Property" : null,
    });
  }

  const residents = [...byKey.values()].sort((a, b) =>
    String(a.property || "").localeCompare(String(b.property || "")) ||
    String(a.name).localeCompare(String(b.name))
  );

  // Per property, so a pilot can be chosen on real numbers rather than by
  // picking a name off a list and hoping it is a decent size.
  const byProperty = new Map();
  for (const r of residents) {
    if (r.propertyId == null) continue;
    const p = byProperty.get(r.propertyId) || { id: r.propertyId, name: r.property, reachable: 0 };
    p.reachable++;
    byProperty.set(r.propertyId, p);
  }

  const value = {
    residents,
    properties: [...byProperty.values()].sort((a, b) => b.reachable - a.reachable),
    // `withoutEmail` is the office's to-do list, not ours. Surfaced, never hidden.
    counts: { current: residents.length + withoutEmail, reachable: residents.length, withoutEmail },
  };
  cache().at = Date.now();
  cache().value = value;
  return value;
}
