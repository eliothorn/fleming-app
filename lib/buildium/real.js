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
  const c = (globalThis.__flOccupancy ||= { at: 0, byProperty: null });
  if (c.byProperty && Date.now() - c.at < OCCUPANCY_TTL_MS) return c.byProperty;

  const tenants = await pageAll("/leases/tenants", { cap: 25 });
  const byProperty = new Map();
  for (const t of tenants) {
    const name = [t.FirstName, t.LastName].filter(Boolean).join(" ").trim();
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
  c.at = Date.now();
  return byProperty;
}

// Buildium calls work orders "Tasks". Endpoints (v1): GET /tasks, GET /rentals,
// GET /vendors, GET /rentals/units, GET /leases, GET /leases/tenants, GET /rentals/owners.
export const realBuildium = {
  // scope: { residentId } — narrow BEFORE truncating. Without this the newest-75
  // cap is applied portfolio-wide first, so a resident whose request isn't among
  // the 75 most recent tickets in the whole company sees an empty app.
  async listOrders(scope = {}) {
    const tasks = await tasksCached();
    const idx = await indexesCached();
    let rows = tasks.filter(isWorkOrder);

    if (scope && scope.residentId != null) {
      rows = rows.filter((t) => t.RequestedByUserEntity?.Id === scope.residentId);
    }
    rows.sort((a, b) => String(b.CreatedDateTime || "").localeCompare(String(a.CreatedDateTime || "")));
    // A single resident has few tickets — never truncate theirs.
    const limited = scope && scope.residentId != null ? rows : rows.slice(0, MAX_ORDERS);
    return limited.map((t) => mapTaskToOrder(t, idx));
  },
  async listVendors() {
    const vendors = await buildiumRequest("/vendors", { query: { limit: 100 } });
    return (Array.isArray(vendors) ? vendors : []).map(mapVendor);
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
  async listOccupancy(propertyId) {
    const pid = Number(propertyId);
    if (!Number.isFinite(pid)) return [];
    const byProperty = await occupancyCached();
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
  // Gated by BUILDIUM_WRITES. With it unset (the default) these build and return
  // the exact payload WITHOUT sending it, so the whole path can be exercised
  // without creating real tickets in the broker's account.

  async createOrder(input) {
    // Buildium files a maintenance request against a LEASE (unit agreement) and a
    // requesting tenant — not a free-text address. Without both, it must not guess.
    const leaseId = input.leaseId ?? null;
    const tenantId = input.residentId ?? null;
    if (leaseId == null || tenantId == null) {
      const err = new Error(
        "Can't file this in Buildium: it needs the resident's lease and tenant id. " +
        "This account isn't linked to a unit yet — the office can link it, or log the request directly in Buildium."
      );
      err.code = "BUILDIUM_IDENTITY_REQUIRED";
      throw err;
    }

    const payload = {
      Title: (input.title || "Maintenance request").slice(0, 127),
      Description: input.notes || input.title || "",
      UnitAgreementId: leaseId,
      RequestedByUserEntityId: tenantId,
      TaskStatus: toBuildiumStatus(input.status),
      Priority: toBuildiumPriority(input.status),
    };
    if (input.categoryId != null) payload.CategoryId = input.categoryId;

    if (!writesEnabled()) return dryRun("POST", "/tasks/residentrequests", payload);

    const created = await buildiumRequest("/tasks/residentrequests", { method: "POST", body: payload });
    invalidateTaskCaches();
    const idx = await indexesCached();
    return mapTaskToOrder(created, idx);
  },

  async updateOrder(id, patch) {
    const taskId = String(id).replace(/^WO-/, "");
    // PUT replaces the whole task and requires Title/TaskStatus/Priority, so read
    // the current record and merge — otherwise an update silently blanks fields.
    const current = await buildiumRequest(`/tasks/${taskId}`);
    const path = putPathFor(current?.TaskType);
    if (!path) {
      const err = new Error(`Buildium has no update endpoint for task type "${current?.TaskType}".`);
      err.code = "BUILDIUM_UNSUPPORTED_TASK_TYPE";
      throw err;
    }

    const payload = {
      Title: current.Title || "Work order",
      TaskStatus: patch.status ? toBuildiumStatus(patch.status) : (current.TaskStatus || "New"),
      Priority: patch.status ? toBuildiumPriority(patch.status, current.Priority) : (current.Priority || "Normal"),
    };
    if (current.Category?.Id != null) payload.CategoryId = current.Category.Id;
    if (current.DueDate) payload.DueDate = current.DueDate;
    if (patch.completionNote) payload.Message = patch.completionNote;
    // vendorId is OUR id space; Buildium's AssignedToUserId is a staff user, so we
    // deliberately do not map it until that mapping is confirmed.

    if (!writesEnabled()) return dryRun("PUT", `${path}/${taskId}`, payload);

    const updated = await buildiumRequest(`${path}/${taskId}`, { method: "PUT", body: payload });
    invalidateTaskCaches();
    const idx = await indexesCached();
    return mapTaskToOrder(updated, idx);
  },
};

// ── Write plumbing ────────────────────────────────────────────────────────────
export function writesEnabled() {
  return process.env.BUILDIUM_WRITES === "true";
}

// Each task type has its own update path; a resident request cannot be PUT to the
// to-do path and vice versa.
function putPathFor(taskType) {
  switch (String(taskType)) {
    case "ResidentRequest": return "/tasks/residentrequests";
    case "RentalOwnerRequest": return "/tasks/rentalownerrequests";
    case "ContactRequest": return "/tasks/contactrequests";
    case "Todo": return "/tasks/todorequests";
    default: return null;
  }
}

function dryRun(method, path, payload) {
  const preview = { dryRun: true, method, path, payload };
  console.log("[buildium:dry-run]", method, path, JSON.stringify(payload));
  return preview;
}

function invalidateTaskCaches() {
  if (globalThis.__flTasks) globalThis.__flTasks = { at: 0, data: null };
  if (globalThis.__flPropStats) globalThis.__flPropStats = { at: 0, data: null };
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

function mapTaskToOrder(t, idx) {
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
    // AssignedToUserId is a STAFF id, not a vendor id, and 0 = unassigned. Real
    // vendor↔task linking is a later step, so leave unassigned for now.
    vendorId: null,
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
