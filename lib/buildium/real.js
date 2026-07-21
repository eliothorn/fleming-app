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

export async function buildiumRequest(path, { method = "GET", query, body } = {}) {
  const url = new URL(BASE() + path);
  if (query) Object.entries(query).forEach(([k, v]) => v != null && url.searchParams.set(k, v));

  const res = await fetch(url, {
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

  if (res.status === 429) throw new Error("Buildium rate limit (10 req/s) exceeded — back off and retry.");
  if (!res.ok) throw new Error(`Buildium ${method} ${path} failed: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// Buildium calls work orders "Tasks". Endpoints (v1): GET /tasks, GET /rentals,
// GET /vendors, GET /rentals/units, GET /leases, GET /leases/tenants, GET /rentals/owners.
export const realBuildium = {
  async listOrders() {
    // Newest first, reasonable page size for a mobile list.
    const tasks = await buildiumRequest("/tasks", { query: { limit: 50, orderby: "CreatedDateTime desc" } });
    return (Array.isArray(tasks) ? tasks : []).map(mapTaskToOrder);
  },
  async listVendors() {
    const vendors = await buildiumRequest("/vendors", { query: { limit: 100 } });
    return (Array.isArray(vendors) ? vendors : []).map(mapVendor);
  },
  async listProperties() {
    const rentals = await buildiumRequest("/rentals", { query: { limit: 100 } });
    return (Array.isArray(rentals) ? rentals : []).map(mapRental);
  },
  // listBalances, listInspections, listTemplates, messagesFor, and all writes are
  // intentionally omitted → index.js falls back to the mock store for them.
};

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

function mapTaskToOrder(t) {
  return {
    id: t.Id != null ? `WO-${t.Id}` : `WO-${Math.random().toString(36).slice(2, 6)}`,
    title: t.Title || t.Subject || "Work order",
    notes: t.Description || t.Message || "",
    status: mapStatus(t.TaskStatus || t.Status, t.Priority),
    category: t.Category?.Name || t.CategoryName || "General",
    address: t.Property?.Name || t.PropertyName || "",
    unit: t.UnitNumber || t.Unit?.Number || "",
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
