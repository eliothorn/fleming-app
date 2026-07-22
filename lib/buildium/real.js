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

export async function buildiumRequest(path, { method = "GET", query, body } = {}) {
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
  c.data = await pageAll("/tasks", { cap: 5 });
  c.at = Date.now();
  return c.data;
}

// Buildium calls work orders "Tasks". Endpoints (v1): GET /tasks, GET /rentals,
// GET /vendors, GET /rentals/units, GET /leases, GET /leases/tenants, GET /rentals/owners.
export const realBuildium = {
  async listOrders() {
    const tasks = await tasksCached();
    const idx = await indexesCached();
    return tasks
      .filter(isWorkOrder)
      .sort((a, b) => String(b.CreatedDateTime || "").localeCompare(String(a.CreatedDateTime || "")))
      .slice(0, MAX_ORDERS)
      .map((t) => mapTaskToOrder(t, idx));
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
  // listBalances, listInspections, listTemplates, messagesFor, and all writes are
  // intentionally omitted → index.js falls back to the mock store for them.
};

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
    unit: unitNo ? (/^\d+$/.test(String(unitNo)) ? `Unit ${unitNo}` : String(unitNo)) : "",
    reported: t.CreatedDateTime ? String(t.CreatedDateTime).slice(0, 10) : "Recently",
    // AssignedToUserId is a STAFF id, not a vendor id, and 0 = unassigned. Real
    // vendor↔task linking is a later step, so leave unassigned for now.
    vendorId: null,
    residentName: t.RequestedByUserEntity
      ? [t.RequestedByUserEntity.FirstName, t.RequestedByUserEntity.LastName].filter(Boolean).join(" ") || null
      : null,
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
