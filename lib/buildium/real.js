// Real Buildium Open API client.
//
// Buildium is SERVER-TO-SERVER ONLY: API-key auth (client id + secret) in headers,
// no CORS, no browser access. This module runs exclusively in API routes.
// Auth: https://developer.buildium.com  → x-buildium-client-id / x-buildium-client-secret
//
// Only the methods that are CONFIRMED-mapped live here. Everything else is left
// undefined so lib/buildium/index.js transparently falls back to the mock store —
// that keeps the app fully working while mappings are finished one endpoint at a
// time, and means writes never accidentally hit the broker's live account until
// intentionally implemented.

const BASE = () => process.env.BUILDIUM_BASE_URL || "https://api.buildium.com/v1";

// Buildium caps clients at 10 requests/second and returns 429 past that. Paging
// several resources concurrently blows straight through it, so every call is
// funnelled through one process-wide queue with a minimum gap between requests.
const MIN_GAP_MS = 130; // ~7.5 req/s, comfortably under the limit
let queue = Promise.resolve();
let lastSentAt = 0;

function schedule(fn) {
  const run = async () => {
    const wait = lastSentAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastSentAt = Date.now();
    return fn();
  };
  queue = queue.then(run, run);
  return queue;
}

async function rawRequest(path, { method, query, body }) {
  const url = new URL(BASE() + path);
  if (query) Object.entries(query).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  return fetch(url, {
    method,
    headers: {
      "x-buildium-client-id": process.env.BUILDIUM_CLIENT_ID,
      "x-buildium-client-secret": process.env.BUILDIUM_CLIENT_SECRET,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
}

// Count of Buildium HTTP calls this process has made. Wall-clock timing is a
// poor guide to whether a change reduced work, because Buildium's own latency
// swings from ~200ms to >15s for the same trivial request. Request count is
// stable and is what the throttle actually spends. Read it via
// /api/buildium/diag?requests=1.
export function buildiumRequestCount(reset = false) {
  const c = (globalThis.__flReqCount ||= { n: 0 });
  const n = c.n;
  if (reset) c.n = 0;
  return n;
}

export async function buildiumRequest(path, { method = "GET", query, body } = {}) {
  (globalThis.__flReqCount ||= { n: 0 }).n++;
  for (let attempt = 0; ; attempt++) {
    const res = await schedule(() => rawRequest(path, { method, query, body }));
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt)); // 0.5s, 1s, 2s
      continue;
    }
    if (res.status === 429) throw new Error("Buildium rate limit (10 req/s) exceeded after retries.");
    if (!res.ok) throw new Error(`Buildium ${method} ${path} failed: ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  }
}

// Page through a list endpoint until exhausted or the cap is hit.
async function pageAll(path, { cap = 10, limit = 100 } = {}) {
  const out = [];
  for (let i = 0; i < cap; i++) {
    const page = await buildiumRequest(path, { query: { limit, offset: i * limit } });
    if (!Array.isArray(page) || page.length === 0) break;
    out.push(...page);
    if (page.length < limit) break;
  }
  return out;
}

// What counts as a "work order". Buildium tasks also hold general contact requests
// and internal to-dos, which aren't maintenance. Measured against live data:
// ResidentRequest/RentalOwnerRequest + anything categorized as maintenance.
// Adjust these two sets to change what the Orders screen shows.
const WORK_ORDER_TYPES = new Set(["residentrequest", "rentalownerrequest"]);
const MAINTENANCE_CATEGORIES = new Set(["maintenance request", "preventative maintenance"]);
function isWorkOrder(t) {
  const type = String(t.TaskType || "").toLowerCase();
  const cat = String(t.Category?.Name || "").toLowerCase();
  return WORK_ORDER_TYPES.has(type) || MAINTENANCE_CATEGORIES.has(cat);
}

const MAX_ORDERS = 75; // keep the mobile list responsive
// Cold load pages ~30 throttled requests (~9s), so cache generously — leases and
// property rosters change slowly, and every warm load is then well under a second.
const STATS_TTL_MS = 10 * 60 * 1000;
const TASKS_TTL_MS = 5 * 60 * 1000;

// Tasks reference their property/unit by id only ({Id,Type,Href} / UnitId), so we
// need lookup tables to show a real address on a work-order card.
async function indexesCached() {
  const c = (globalThis.__flIndexes ||= { at: 0, data: null });
  if (c.data && Date.now() - c.at < STATS_TTL_MS) return c.data;
  const rentals = await pageAll("/rentals", { cap: 5 });
  const units = await pageAll("/rentals/units", { cap: 10 });
  c.data = {
    propName: new Map(rentals.map((r) => [r.Id, r.Name || r.Address?.AddressLine1 || ""])),
    unitNum: new Map(units.map((u) => [u.Id, u.UnitNumber ?? u.Number ?? ""])),
  };
  c.at = Date.now();
  return c.data;
}

// listOrders and listProperties both need the task list — fetch it once and share.
async function tasksCached() {
  const c = (globalThis.__flTasks ||= { at: 0, data: null });
  if (c.data && Date.now() - c.at < TASKS_TTL_MS) return c.data;
  // Deeper history than the display cap: a resident's own ticket may be well
  // outside the newest 75 company-wide, and we must still find it for them.
  c.data = await pageAll("/tasks", { cap: 12 });
  c.at = Date.now();
  return c.data;
}

// Who is actually doing the work.
//
// Buildium models this in two layers: a TASK is the request ("no hot water"),
// and a WORK ORDER is the job raised against it and given to a vendor. The app
// only ever read the first layer, which is why every job showed "Unassigned" —
// the data was there all along, on a record we weren't looking at.
//
// Measured on this account: 2,388 work orders, every one carrying a VendorId
// that resolves to a real vendor.
//
// They come back OLDEST FIRST, and the app displays the newest tasks — so
// paging from offset 0 fetched a thousand work orders from 2020 and matched
// none of them. `orderby=Id desc` (verified working on this account; a leading
// "-" is rejected) puts the newest first, which both fixes the mismatch and
// halves the requests needed.
const WORKORDERS_TTL_MS = 5 * 60 * 1000;
const WORKORDER_PAGES = 6; // 600 newest — comfortably covers the newest MAX_ORDERS tasks

async function workOrdersByTask() {
  const c = (globalThis.__flWorkOrders ||= { at: 0, byTask: null });
  if (c.byTask && Date.now() - c.at < WORKORDERS_TTL_MS) return c.byTask;

  const orders = [];
  for (let i = 0; i < WORKORDER_PAGES; i++) {
    const page = await buildiumRequest("/workorders", {
      query: { limit: 100, offset: i * 100, orderby: "Id desc" },
    });
    if (!Array.isArray(page) || page.length === 0) break;
    orders.push(...page);
    if (page.length < 100) break;
  }

  const byTask = new Map();
  for (const w of orders) {
    const taskId = w.Task?.Id;
    if (taskId == null || w.VendorId == null) continue;
    // A task can carry more than one work order over its life; the newest
    // (highest id) is the one currently in force.
    const prev = byTask.get(taskId);
    if (prev && prev.workOrderId > w.Id) continue;
    byTask.set(taskId, {
      vendorId: w.VendorId,
      workOrderId: w.Id,
      workOrderStatus: w.Status || null,
      // Whether anyone may let themselves in, and what they need to know before
      // they do. Measured across 400 recent work orders: EntryAllowed is always
      // present ("Yes" / "No" / "Unknown") and EntryNotes is filled on 81% —
      // real operational detail like "Pets on Property: Yes" or "Please call me
      // first, I only work 10 minutes away".
      entryAllowed: w.EntryAllowed || null,
      entryNotes: w.EntryNotes || null,
    });
  }
  c.byTask = byTask;
  c.at = Date.now();
  return byTask;
}

// What a resident actually owes.
//
// /leases/outstandingbalances returns a row per lease that has money
// outstanding, with 0-30 / 31-60 / 61-90 / 90+ day ageing. Measured on this
// account: only 65 leases carry a balance at all, so the whole set fits in one
// request. A lease that is absent owes nothing — the endpoint lists outstanding
// balances, so absence is a real answer, not missing data.
//
// There is no per-lease filter (leaseids= is ignored and returns nothing), which
// is why this fetches the lot and indexes it rather than querying one lease.
const BALANCES_TTL_MS = 5 * 60 * 1000;
async function balancesByLease() {
  const c = (globalThis.__flBalances ||= { at: 0, byLease: null });
  if (c.byLease && Date.now() - c.at < BALANCES_TTL_MS) return c.byLease;

  const rows = await pageAll("/leases/outstandingbalances", { cap: 10 });
  const byLease = new Map();
  for (const r of rows) {
    if (r.LeaseId == null) continue;
    byLease.set(r.LeaseId, {
      total: Number(r.TotalBalance) || 0,
      current: Number(r.Balance0To30Days) || 0,
      over30: Number(r.Balance31To60Days) || 0,
      over60: Number(r.Balance61To90Days) || 0,
      over90: Number(r.BalanceOver90Days) || 0,
    });
  }
  c.byLease = byLease;
  c.at = Date.now();
  return byLease;
}

// Units genuinely available to move into.
//
// A unit with no active lease is not automatically "available" — 150 of the 678
// have none, but most are mid-turnover, under repair, or simply not being
// marketed. The honest set is those the office has actually put a MarketRent
// against, which is 19. Listing the other 131 to residents would invite
// enquiries about flats nobody is letting.
const VACANCY_TTL_MS = 10 * 60 * 1000;
async function vacanciesCached() {
  const c = (globalThis.__flVacancies ||= { at: 0, data: null });
  if (c.data && Date.now() - c.at < VACANCY_TTL_MS) return c.data;

  const [units, leases] = await Promise.all([pageAll("/rentals/units", { cap: 10 }), pageAll("/leases", { cap: 20 })]);
  const taken = new Set(leases.filter((l) => l.LeaseStatus === "Active" && l.UnitId != null).map((l) => l.UnitId));

  const BEDS = { Studio: "Studio", OneBed: "1 bed", TwoBed: "2 bed", ThreeBed: "3 bed", FourBed: "4 bed", FiveBed: "5 bed", SixBed: "6 bed" };
  c.data = units
    .filter((u) => !taken.has(u.Id) && Number(u.MarketRent) > 0)
    .map((u) => ({
      id: u.Id,
      propertyId: u.PropertyId,
      property: u.BuildingName || u.Address?.AddressLine1 || "Property",
      unit: u.UnitNumber ? String(u.UnitNumber) : "",
      rent: Number(u.MarketRent),
      beds: BEDS[u.UnitBedrooms] || (u.UnitBedrooms ? String(u.UnitBedrooms) : null),
      baths: u.UnitBathrooms ? String(u.UnitBathrooms).replace(/([a-z])([A-Z])/g, "$1 $2") : null,
      size: u.UnitSize || null,
      description: String(u.Description || "").trim() || null,
      address: [u.Address?.AddressLine1, u.Address?.City, u.Address?.State].filter(Boolean).join(", "),
    }))
    .sort((a, b) => a.rent - b.rent);
  c.at = Date.now();
  return c.data;
}

// Owners reachable by email, indexed by the properties they own. Used to send
// an inspection report or an owner update to the right person.
const OWNERS_TTL_MS = 10 * 60 * 1000;
async function ownersByProperty() {
  const c = (globalThis.__flOwners ||= { at: 0, byProperty: null });
  if (c.byProperty && Date.now() - c.at < OWNERS_TTL_MS) return c.byProperty;

  const owners = await pageAll("/rentals/owners", { cap: 5 });
  const byProperty = new Map();
  for (const o of owners) {
    const email = String(o.Email || "").trim();
    if (!email) continue;
    const name = o.CompanyName || [o.FirstName, o.LastName].filter(Boolean).join(" ").trim() || email;
    for (const pid of o.PropertyIds || []) {
      const list = byProperty.get(pid) || [];
      list.push({ id: o.Id, name, email });
      byProperty.set(pid, list);
    }
  }
  c.byProperty = byProperty;
  c.at = Date.now();
  return byProperty;
}

// Tenancy directory: property id -> the active leases in it, each with the unit
// and the tenant who can be named as the requester. Pages the whole tenant
// roster, so it is cached like the other rosters.
// Buildium's signed image links live exactly 302 seconds — measured, not
// assumed. Caching one for longer than that hands the browser a dead URL, which
// is precisely what a 30-minute cache did: the image silently failed and the
// card fell back to its tile. 60s absorbs a burst of cards without ever
// outliving the signature.
const PHOTO_TTL_MS = 60 * 1000;

const OCCUPANCY_TTL_MS = 5 * 60 * 1000;
async function occupancyCached() {
  const c = (globalThis.__flOccupancy ||= { at: 0, byProperty: null, byTenant: null });
  if (c.byProperty && Date.now() - c.at < OCCUPANCY_TTL_MS) return c;

  const tenants = await pageAll("/leases/tenants", { cap: 25 });
  const byProperty = new Map();
  // Same sweep also yields a contact book, so notifying a resident costs no
  // extra requests.
  const byTenant = new Map();
  for (const t of tenants) {
    const name = [t.FirstName, t.LastName].filter(Boolean).join(" ").trim();
    byTenant.set(t.Id, { id: t.Id, name: name || `Tenant ${t.Id}`, email: String(t.Email || "").trim() || null });
    for (const l of t.Leases || []) {
      // Only a current tenancy can raise a request against its unit.
      if (l.LeaseStatus !== "Active" || l.PropertyId == null || l.Id == null) continue;
      const list = byProperty.get(l.PropertyId) || [];
      list.push({
        leaseId: l.Id,
        unitId: l.UnitId ?? null,
        unitNumber: l.UnitNumber != null ? String(l.UnitNumber) : "",
        tenantId: t.Id,
        tenantName: name || `Tenant ${t.Id}`,
      });
      byProperty.set(l.PropertyId, list);
    }
  }
  c.byProperty = byProperty;
  c.byTenant = byTenant;
  c.at = Date.now();
  return c;
}

// Buildium calls work orders "Tasks". Endpoints (v1): GET /tasks, GET /rentals,
// GET /vendors, GET /rentals/units, GET /leases, GET /leases/tenants, GET /rentals/owners.
export const realBuildium = {
  // scope: { residentId } — narrow BEFORE truncating. Without this the newest-75
  // cap is applied portfolio-wide first, so a resident whose request isn't among
  // the 75 most recent tickets in the whole company sees an empty app.
  // scope.withVendors — page the work orders so each job can name the vendor on
  // it. Costs ~12 requests, so callers opt in per role rather than every load
  // paying for it.
  async listOrders(scope = {}) {
    const tasks = await tasksCached();
    const idx = await indexesCached();
    const byTask = scope && scope.withVendors ? await workOrdersByTask() : null;
    let rows = tasks.filter(isWorkOrder);

    if (scope && scope.residentId != null) {
      rows = rows.filter((t) => t.RequestedByUserEntity?.Id === scope.residentId);
    }
    rows.sort((a, b) => String(b.CreatedDateTime || "").localeCompare(String(a.CreatedDateTime || "")));
    // A single resident has few tickets — never truncate theirs.
    const limited = scope && scope.residentId != null ? rows : rows.slice(0, MAX_ORDERS);
    return limited.map((t) => mapTaskToOrder(t, idx, byTask));
  },
  async listVendors() {
    // Was a single page of 100. This account has 429 vendors, so three quarters
    // of the roster were missing and any job assigned to one of them resolved
    // to no name at all.
    const vendors = await pageAll("/vendors", { cap: 10 });
    return vendors.map(mapVendor);
  },
  async listProperties() {
    const cache = (globalThis.__flPropStats ||= { at: 0, data: null });
    if (cache.data && Date.now() - cache.at < STATS_TTL_MS) return cache.data;

    // Sequential on purpose: the shared queue throttles anyway, and this keeps
    // the request pattern predictable.
    const rentals = await pageAll("/rentals", { cap: 5 });
    const leases = await pageAll("/leases", { cap: 20 });
    const tasks = await tasksCached();

    // Occupancy + monthly revenue come from ACTIVE leases, grouped by property.
    const stats = new Map();
    const bump = (id, patch) => {
      const s = stats.get(id) || { occupied: new Set(), rent: 0, open: 0, urgent: 0 };
      patch(s);
      stats.set(id, s);
    };
    for (const l of leases) {
      if (l.LeaseStatus !== "Active" || l.PropertyId == null) continue;
      bump(l.PropertyId, (s) => {
        if (l.UnitId != null) s.occupied.add(l.UnitId);
        s.rent += Number(l.AccountDetails?.Rent) || 0;
      });
    }
    // Open / urgent work-order counts per property.
    for (const t of tasks) {
      if (!isWorkOrder(t)) continue;
      const pid = t.Property?.Id ?? t.PropertyId;
      if (pid == null || String(t.TaskStatus) === "Completed") continue;
      bump(pid, (s) => {
        s.open += 1;
        if (/high|urgent/i.test(t.Priority || "")) s.urgent += 1;
      });
    }

    const data = rentals.map((r) => {
      const s = stats.get(r.Id);
      return { ...mapRental(r), occupied: s ? s.occupied.size : 0, openOrders: s?.open || 0, urgentOrders: s?.urgent || 0, monthlyRev: s?.rent ? usd(s.rent) : "$0" };
    });
    cache.data = data; cache.at = Date.now();
    return data;
  },
  // Active tenancies for one property, so office staff can file a request
  // against a real unit. Buildium will not accept a maintenance request without
  // a lease (UnitAgreementId) and a requesting tenant (RequestedByUserEntityId),
  // and the staff form had no way to supply either.
  //
  // Verified against live data: /leases carries the lease and unit but only
  // tenant IDs, with no names; /leases/tenants carries names AND each tenant's
  // leases with property, unit and status. One sweep of the latter therefore
  // gives everything the picker needs. (A `statuses=Active` filter on /leases is
  // silently ignored by this account, so status is filtered here.)
  // What one lease owes. Returns a zero balance rather than null when the lease
  // simply isn't in the outstanding list — that is "paid up", which is a real
  // answer and should read as one.
  async leaseBalance(leaseId) {
    const id = Number(leaseId);
    if (!Number.isFinite(id)) return null;
    const byLease = await balancesByLease();
    return byLease.get(id) || { total: 0, current: 0, over30: 0, over60: 0, over90: 0 };
  },

  // Units a resident could actually move into.
  async listVacancies() {
    return await vacanciesCached();
  },

  // A resident's contact details, for telling them something happened. Comes
  // out of the tenancy sweep that is already cached, so it costs nothing extra.
  async tenantContact(tenantId) {
    const id = Number(tenantId);
    if (!Number.isFinite(id)) return null;
    const { byTenant } = await occupancyCached();
    return byTenant.get(id) || null;
  },

  // Who to send a report about this property to.
  async ownersFor(propertyId) {
    const pid = Number(propertyId);
    if (!Number.isFinite(pid)) return [];
    return (await ownersByProperty()).get(pid) || [];
  },

  // The conversation on one work order.
  //
  // Buildium keeps the back-and-forth in the task's history, one entry per
  // update, each carrying the note that was written and who wrote it. That is
  // the real message trail — every resident request sampled had one. Fetched per
  // thread rather than for every order at once, because it costs a request each.
  //
  // Note the field is CreatedDateTIme — Buildium's own spelling, not a typo here.
  async orderMessages(orderId) {
    const taskId = String(orderId).replace(/^WO-/, "");
    if (!/^\d+$/.test(taskId)) return [];
    const entries = await buildiumRequest(`/tasks/${taskId}/history`, { query: { limit: 50 } });
    return (Array.isArray(entries) ? entries : [])
      .filter((e) => String(e.Message || "").trim())
      .map((e) => {
        const u = e.CreatedByUser || {};
        const name = [u.FirstName, u.LastName].filter(Boolean).join(" ").trim();
        // UserType tells us whether this came from the office or the resident,
        // which is what decides the side of the thread it sits on.
        const type = String(u.UserType || "").toLowerCase();
        // Buildium's automated dispatch entries come through authored by
        // "System". They are not the resident talking, and putting them on the
        // resident's side of the thread misrepresents who said what.
        const isSystem = /^system$/i.test(name);
        return {
          id: e.Id,
          body: String(e.Message).trim(),
          author: isSystem ? "Automated update" : (name || "Stephen Fleming Realty"),
          system: isSystem,
          fromOffice: isSystem || type.includes("staff") || type.includes("propertymanager") || !name,
          at: e.CreatedDateTIme || e.CreatedDateTime || null,
          status: e.TaskStatus || null,
        };
      })
      .sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
  },

  async listOccupancy(propertyId) {
    const pid = Number(propertyId);
    if (!Number.isFinite(pid)) return [];
    const { byProperty } = await occupancyCached();
    return (byProperty.get(pid) || []).slice().sort((a, b) =>
      String(a.unitNumber).localeCompare(String(b.unitNumber), undefined, { numeric: true }) ||
      a.tenantName.localeCompare(b.tenantName)
    );
  },

  // The broker's own photo of a property, when they have uploaded one (about
  // 60% have). Buildium stores only a file name, so a signed CloudFront link is
  // minted on demand and expires; it is cached well inside that lifetime.
  //
  // The mint is a POST, but it creates a download link and changes nothing in
  // the account — this is not a write in the BUILDIUM_WRITES sense.
  //
  // Two requests per property, so this is fetched lazily per visible card and is
  // deliberately NOT part of the bootstrap sweep: eagerly photographing 306
  // properties would be 600+ requests against a 10/s limit.
  async propertyImageUrl(propertyId) {
    const pid = Number(propertyId);
    if (!Number.isFinite(pid)) return null;
    const cache = (globalThis.__flPropPhotos ||= new Map());
    const hit = cache.get(pid);
    if (hit && Date.now() - hit.at < PHOTO_TTL_MS) return hit.url;

    let url = null;
    try {
      const images = await buildiumRequest(`/rentals/${pid}/images`, { query: { limit: 1 } });
      const img = Array.isArray(images) ? images[0] : null;
      if (img?.Id != null) {
        const dl = await buildiumRequest(`/rentals/${pid}/images/${img.Id}/downloadrequests`, { method: "POST", body: {} });
        url = dl?.DownloadUrl || null;
      }
    } catch {
      url = null; // a missing photo must never break a property card
    }
    // Misses are cached too: ~40% of properties have no photo, and re-asking on
    // every scroll would burn the request budget for nothing.
    cache.set(pid, { url, at: Date.now() });
    return url;
  },

  // ── WRITES ──────────────────────────────────────────────────────────────────
  //
  // Buildium's update endpoints REPLACE the record. In their own words, on every
  // task and work-order update operation:
  //
  //   "Any field not included in the update request will be set to either an
  //    empty string or null in the database depending on the field definition.
  //    The recommended workflow to ensure no data is inadvertently overwritten is
  //    to execute a GET request for the resource you're about to update and then
  //    use this response to fill any of the fields that are not being updated."
  //
  // So every update here reads the current record first and echoes back every
  // updatable field. This is not defensive politeness. Measured on the 1,151
  // tasks this app actually displays: 829 carry a staff assignment and 539 carry
  // a subcategory, and a partial payload would have erased both the first time
  // anyone changed a status.
  //
  // Gated by BUILDIUM_WRITES. With it unset (the default) these build and return
  // the exact payload WITHOUT sending it, so the whole path — including the
  // read-and-merge — can be exercised without touching the broker's account.

  async createOrder(input) {
    // Buildium files a maintenance request against a LEASE (unit agreement) and a
    // requesting tenant — not a free-text address. Without both, it must not guess.
    const leaseId = toId(input.leaseId);
    const tenantId = toId(input.residentId);
    if (leaseId == null || tenantId == null) {
      const err = new Error(
        "Can't file this in Buildium: it needs the resident's lease and tenant id. " +
        "This account isn't linked to a unit yet — the office can link it, or log the request directly in Buildium."
      );
      err.code = "BUILDIUM_IDENTITY_REQUIRED";
      throw err;
    }

    const { categoryId, subCategoryId } = buildiumCategory(input.category);
    const payload = {
      Title: String(input.title || "Maintenance request").slice(0, 127),
      Description: String(input.notes || input.title || "").slice(0, 65500),
      UnitAgreementId: leaseId,
      // Buildium spells this RequestedByEntityId on the way IN and
      // RequestedByUserEntity on the way OUT. Sending the response spelling —
      // which this did — is a 422 with no hint as to why.
      RequestedByEntityId: tenantId,
      // A request that has just been filed is open, whatever arrived in the body.
      // Without this clamp a crafted request could create an already-Completed
      // ticket, which is a request nobody will ever look at.
      TaskStatus: toBuildiumStatus(input.status) === "InProgress" ? "InProgress" : "New",
      Priority: toBuildiumPriority(input.status),
      CategoryId: categoryId,
      SubCategoryId: subCategoryId,
    };

    if (!writesEnabled()) return dryRun("POST", "/tasks/residentrequests", payload);

    const created = await buildiumRequest("/tasks/residentrequests", { method: "POST", body: payload });
    invalidateTaskCaches();
    const idx = await indexesCached();
    return mapTaskToOrder(created, idx);
  },

  async updateOrder(id, patch) {
    const taskId = String(id).replace(/^WO-/, "");
    if (!/^\d+$/.test(taskId)) {
      const err = new Error(`"${id}" is not a Buildium task id.`);
      err.code = "BUILDIUM_BAD_ID";
      throw err;
    }

    // Assigning a contractor is a different record entirely — see assignVendor.
    // Done first so that if it is refused, no half-change has been made.
    let assignment = null;
    if (patch.vendorId != null) assignment = await realBuildium.assignVendor(taskId, patch.vendorId, patch);

    const touchesTask = patch.status != null || patch.completionNote != null;
    if (!touchesTask) {
      if (assignment) return assignment;
      // Nothing here is ours to write — vendorCompleted and photo paths live in
      // the app's own storage. Report that plainly rather than PUTting the task
      // back over itself for no reason.
      return { dryRun: !writesEnabled(), method: "NONE", path: `/tasks/${taskId}`, payload: null, note: "no Buildium-backed field changed" };
    }

    // The generic task read is what tells us the type, and therefore which typed
    // endpoint to write back to.
    const generic = await buildiumRequest(`/tasks/${taskId}`);
    const type = TASK_TYPES[String(generic?.TaskType)];
    if (!type) {
      const err = new Error(`Buildium has no update endpoint for task type "${generic?.TaskType}".`);
      err.code = "BUILDIUM_UNSUPPORTED_TASK_TYPE";
      throw err;
    }

    // Then the TYPED read, because only it carries the type-specific fields that
    // the PUT would otherwise null — ContactDetail on a contact request, and the
    // property/unit link on an owner request.
    const current = await buildiumRequest(`${type.path}/${taskId}`);

    // The office's own note of who is handling this. The API reports "nobody" as
    // 0 while the save schema wants null, so 0 is normalised — echoing 0 back
    // would be a staff id that does not exist.
    const assignedTo = current.AssignedToUserId || null;

    const payload = {
      Title: String(current.Title || "Work order").slice(0, 127),
      TaskStatus: patch.status ? toBuildiumStatus(patch.status) : (current.TaskStatus || "New"),
      Priority: patch.status ? toBuildiumPriority(patch.status, current.Priority) : (current.Priority || "Normal"),
      // Everything below is echoed back unchanged. Omitting any of it is what
      // erases it.
      CategoryId: current.Category?.Id ?? null,
      SubCategoryId: current.Category?.SubCategory?.Id ?? null,
      AssignedToUserId: assignedTo,
      DueDate: current.DueDate ? String(current.DueDate).slice(0, 10) : null,
    };
    // An owner request is linked to its property and unit by these two fields
    // rather than by a lease; drop them and the request is orphaned.
    if (type.carriesPropertyLink) {
      payload.PropertyId = current.Property?.Id ?? null;
      payload.UnitId = current.UnitId ?? null;
    }
    // A contact request holds the enquirer's name, email and phone here. It is
    // the only record of how to reach someone who is not yet a tenant.
    if (type.carriesContactDetail) payload.ContactDetail = current.ContactDetail ?? null;

    // Buildium requires a real staff user on a to-do, so one with nobody assigned
    // cannot be updated through the API at all. Say so rather than returning an
    // opaque 422.
    if (type.requiresAssignee && !assignedTo) {
      const err = new Error(
        "Buildium won't let this one be changed from the app: it's an internal to-do with nobody assigned to it. Change it in Buildium instead."
      );
      err.code = "BUILDIUM_ASSIGNEE_REQUIRED";
      throw err;
    }

    // Message is the note attached to THIS update, not a stored field, so it is
    // sent only when there is genuinely something to record.
    if (patch.completionNote) payload.Message = String(patch.completionNote).slice(0, 65500);

    if (!writesEnabled()) {
      const preview = dryRun("PUT", `${type.path}/${taskId}`, payload);
      return assignment ? { ...preview, assignment } : preview;
    }

    const updated = await buildiumRequest(`${type.path}/${taskId}`, { method: "PUT", body: payload });
    invalidateTaskCaches();
    const idx = await indexesCached();
    return mapTaskToOrder(updated, idx);
  },

  // Give a job to a contractor.
  //
  // In Buildium a TASK is the request and a WORK ORDER is the job raised against
  // it and handed to a vendor — AssignedToUserId on the task is a member of
  // staff, not a contractor. So "assign Acme Plumbing" is a work-order write, and
  // it is the only write in this app that can reach someone outside the office.
  // That is why it has its own switch: BUILDIUM_WRITE_WORKORDERS.
  async assignVendor(taskId, vendorId, patch = {}) {
    const vid = toId(vendorId);
    const tid = toId(String(taskId).replace(/^WO-/, ""));
    if (vid == null || tid == null) {
      const err = new Error("Assigning a contractor needs both the job and the contractor.");
      err.code = "BUILDIUM_BAD_ID";
      throw err;
    }

    const existingId = (await workOrdersByTask()).get(tid)?.workOrderId ?? null;

    if (existingId != null) {
      // Same replace-the-record rule as tasks, and this one is worse: the docs
      // note that omitted line items are "removed and replaced", so an invoice
      // already recorded against the job would vanish.
      const wo = await buildiumRequest(`/workorders/${existingId}`);
      const payload = {
        Title: wo.Title ?? null,
        WorkDetails: wo.WorkDetails ?? null,
        InvoiceNumber: wo.InvoiceNumber ?? null,
        ChargeableTo: wo.ChargeableTo ?? null,
        EntryAllowed: wo.EntryAllowed || "Unknown",
        EntryNotes: wo.EntryNotes ?? null,
        VendorNotes: wo.VendorNotes ?? null,
        EntryContactIds: (wo.EntryContacts || []).map((c) => c.Id).filter((n) => n != null),
        LineItems: wo.LineItems || [],
        VendorId: vid, // the one thing actually changing
      };
      if (!workOrderWritesEnabled()) return dryRun("PUT", `/workorders/${existingId}`, payload);
      const updated = await buildiumRequest(`/workorders/${existingId}`, { method: "PUT", body: payload });
      invalidateTaskCaches();
      return { workOrderId: updated?.Id ?? existingId, vendorId: vid };
    }

    // No work order yet: raise one against the task.
    const task = await buildiumRequest(`/tasks/${tid}`);
    const payload = {
      TaskId: tid,
      VendorId: vid,
      Title: String(task?.Title || "Work order").slice(0, 127),
      WorkDetails: String(task?.Description || "").slice(0, 65535) || null,
      // Buildium requires this and offers no "not asked" value other than
      // Unknown. The app does not collect entry permission at assignment time, so
      // Unknown is the honest answer — claiming Yes would tell a contractor they
      // may let themselves into someone's home.
      EntryAllowed: "Unknown",
      EntryNotes: patch.entryNotes ? String(patch.entryNotes).slice(0, 65535) : null,
    };
    if (!workOrderWritesEnabled()) return dryRun("POST", "/workorders", payload);
    const created = await buildiumRequest("/workorders", { method: "POST", body: payload });
    invalidateTaskCaches();
    return { workOrderId: created?.Id ?? null, vendorId: vid };
  },
};

// ── Write plumbing ────────────────────────────────────────────────────────────
export function writesEnabled() {
  return process.env.BUILDIUM_WRITES === "true";
}

// Raising a work order is the only write that can email someone outside the
// office — Buildium can notify the contractor. It therefore gets its own switch
// on top of BUILDIUM_WRITES, the same way live reads got one on top of the keys.
export function workOrderWritesEnabled() {
  return writesEnabled() && process.env.BUILDIUM_WRITE_WORKORDERS === "true";
}

// Each task type has its own update path AND its own extra fields — verified
// against the live API, where a PUT missing them returns 422 rather than
// half-applying. A resident request cannot be PUT to the to-do path.
const TASK_TYPES = {
  ResidentRequest: { path: "/tasks/residentrequests" },
  // Owner requests are tied to a property and unit directly, not through a lease.
  RentalOwnerRequest: { path: "/tasks/rentalownerrequests", carriesPropertyLink: true },
  // Buildium rejects a to-do update without a real staff user on it.
  Todo: { path: "/tasks/todorequests", carriesPropertyLink: true, requiresAssignee: true },
  // Holds the enquirer's contact details, and rejects an update without them.
  ContactRequest: { path: "/tasks/contactrequests", carriesContactDetail: true },
};

// The app's own category chips, mapped onto the categories this account actually
// uses. Ids read from /tasks/categories on the live account: 1684 "Maintenance
// Request" with subcategories 1 General, 3 Electrical, 4 HVAC, 5 Key and lock,
// 7 Outside, 8 Plumbing.
//
// Everything the app files is a maintenance request, so the parent is always
// 1684. "Inspection" and "Move-out" have no exact counterpart here and fall to
// General rather than being forced into a category that would mislead a report.
const CATEGORY_MAP = {
  HVAC: 4, Plumbing: 8, Electrical: 3, Security: 5, Landscaping: 7,
  General: 1, Inspection: 1, "Move-out": 1,
};
const MAINTENANCE_CATEGORY_ID = 1684;
function buildiumCategory(name) {
  const sub = CATEGORY_MAP[String(name || "").trim()] ?? CATEGORY_MAP.General;
  return { categoryId: MAINTENANCE_CATEGORY_ID, subCategoryId: sub };
}

// Buildium rejects string ids, and a malformed one should read as "not linked"
// rather than surface as an opaque validation error.
function toId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

// Which contractor a job currently belongs to — the check that stops one vendor
// altering another's work. Cheap: the work-order index is already cached.
export async function vendorForTask(taskId) {
  const tid = toId(String(taskId).replace(/^WO-/, ""));
  if (tid == null) return null;
  return (await workOrdersByTask()).get(tid)?.vendorId ?? null;
}

// Is this lease/tenant pair a real, current tenancy?
//
// Staff file requests on a resident's behalf, so the pair arrives from the
// browser rather than from a session. Buildium accepts any two ids that exist
// independently, which means a stale picker or a mistyped value files a real
// resident's complaint against a different resident's lease — and the app is
// then the reason the office's records are wrong. Checked against the same
// occupancy index the unit picker was populated from.
export async function isCurrentTenancy(leaseId, tenantId) {
  const lid = toId(leaseId);
  const tid = toId(tenantId);
  if (lid == null || tid == null) return false;
  const { byProperty } = await occupancyCached();
  for (const list of byProperty.values()) {
    if (list.some((t) => t.leaseId === lid && t.tenantId === tid)) return true;
  }
  return false;
}

function dryRun(method, path, payload) {
  const preview = { dryRun: true, method, path, payload };
  console.log("[buildium:dry-run]", method, path, JSON.stringify(payload));
  return preview;
}

// Every cache that a write can invalidate. __flWorkOrders was missing, so after
// assigning a contractor the app kept showing the old one for up to five minutes
// — and an employee seeing a stale assignment is one who assigns again.
function invalidateTaskCaches() {
  if (globalThis.__flTasks) globalThis.__flTasks = { at: 0, data: null };
  if (globalThis.__flPropStats) globalThis.__flPropStats = { at: 0, data: null };
  if (globalThis.__flWorkOrders) globalThis.__flWorkOrders = { at: 0, byTask: null };
}

// App status → Buildium. Buildium separates status from priority, while the app
// folds "urgent" into status, so urgency maps onto Priority.
// Values verified against this account's live data: TaskStatus New/InProgress/
// Completed, Priority High/Normal/Low.
function toBuildiumStatus(s) {
  switch (String(s)) {
    case "done": return "Completed";
    case "scheduled":
    case "review": return "InProgress";
    case "urgent":
    case "pending":
    default: return "New";
  }
}
function toBuildiumPriority(s, fallback = "Normal") {
  if (String(s) === "urgent") return "High";
  return fallback || "Normal";
}

const usd = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

// ── Field mappers ─────────────────────────────────────────────────────────────
// Defensive by design: anything unknown degrades to a safe default rather than
// crashing the UI (statuses the app doesn't recognize would otherwise break badges).
const STATUS_MAP = {
  new: "pending", open: "pending", inprogress: "scheduled", "in progress": "scheduled",
  pending: "pending", scheduled: "scheduled", completed: "done", closed: "done",
  deferred: "review", onhold: "review", "awaiting review": "review", cancelled: "done",
};
function mapStatus(s, priority) {
  const key = String(s || "").toLowerCase().replace(/_/g, "");
  if (STATUS_MAP[key]) {
    // Escalate high-priority open tasks to "urgent" so they surface like the demo.
    if (["pending", "scheduled"].includes(STATUS_MAP[key]) && /high|urgent/i.test(priority || "")) return "urgent";
    return STATUS_MAP[key];
  }
  return "pending";
}

function mapTaskToOrder(t, idx, byTask) {
  const propId = t.Property?.Id ?? t.PropertyId;
  const unitNo = t.UnitNumber || t.Unit?.Number || (t.UnitId != null ? idx?.unitNum.get(t.UnitId) : "");
  return {
    id: t.Id != null ? `WO-${t.Id}` : `WO-${Math.random().toString(36).slice(2, 6)}`,
    title: t.Title || t.Subject || "Work order",
    notes: t.Description || t.Message || "",
    status: mapStatus(t.TaskStatus || t.Status, t.Priority),
    category: t.Category?.Name || t.CategoryName || "General",
    address: t.Property?.Name || t.PropertyName || (propId != null ? idx?.propName.get(propId) : "") || "",
    // Carried so a work order can show the building it's about.
    propertyId: propId ?? null,
    unit: unitNo ? (/^\d+$/.test(String(unitNo)) ? `Unit ${unitNo}` : String(unitNo)) : "",
    reported: t.CreatedDateTime ? String(t.CreatedDateTime).slice(0, 10) : "Recently",
    // AssignedToUserId is a STAFF id, not a vendor id, so it is not this. The
    // vendor lives on the work order raised against this task; null here means
    // either no work order exists or the caller didn't ask for them.
    vendorId: byTask?.get(t.Id)?.vendorId ?? null,
    // Access instructions for whoever attends. Deliberately no invoice or
    // amount alongside them: measured over 400 recent work orders, this account
    // never fills InvoiceNumber, ChargeableTo or LineItems, and Amount is 0.00
    // on every single one. A billing panel would be permanently empty, and
    // "$0.00" reads as "this job cost nothing" rather than "not recorded".
    entryAllowed: byTask?.get(t.Id)?.entryAllowed ?? null,
    entryNotes: byTask?.get(t.Id)?.entryNotes ?? null,
    residentName: t.RequestedByUserEntity
      ? [t.RequestedByUserEntity.FirstName, t.RequestedByUserEntity.LastName].filter(Boolean).join(" ") || null
      : null,
    // Stable Buildium id of whoever raised it. Scoping a resident's own orders by
    // this is far more reliable than comparing name strings (measured on live data:
    // 91% of resident requests carry an id that maps to a known tenant, vs name
    // matching which breaks on middle initials like "Irene M Renzo").
    residentId: t.RequestedByUserEntity?.Id ?? null,
  };
}
function mapVendor(v) {
  const name = v.CompanyName || [v.FirstName, v.LastName].filter(Boolean).join(" ") || "Vendor";
  return {
    id: v.Id,
    name,
    specialty: v.Category?.Name || v.VendorCategory?.Name || "",
    phone: v.PhoneNumbers?.[0]?.Number || v.PrimaryPhone || "",
    location: v.Address?.City || "",
    logo: null,
    initials: name.slice(0, 2).toUpperCase(),
    color: "#1B3A6B",
  };
}
function mapRental(r) {
  return {
    id: r.Id,
    name: r.Name || r.Address?.AddressLine1 || "Property",
    // The postal address, kept separate from the display name. Names are often
    // shorthand the office uses ("North U.S. 15", "Billing Purposes Only") and
    // will not geocode; every property has a complete address, and every one of
    // the 306 carries street, city, state and ZIP.
    address: [r.Address?.AddressLine1, r.Address?.City, r.Address?.State, r.Address?.PostalCode]
      .filter(Boolean).join(", ") || null,
    units: r.NumberUnits ?? r.Units?.length ?? 0,
    // These require additional endpoints (leases, ledger, inspections) — computed
    // in a later step; shown as placeholders for now.
    occupied: 0,
    openOrders: 0,
    urgentOrders: 0,
    nextInspection: "—",
    monthlyRev: "—",
  };
}
