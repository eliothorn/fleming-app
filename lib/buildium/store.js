// In-memory mock store. Seeded from mockData; survives Next.js hot reloads via
// globalThis so created work orders / inspections / templates persist during a
// dev session. Resets on full server restart (fine for a mock backend).

import { VENDORS, ORDERS, OWNER_PROPS, RESIDENT_BALANCES, TEMPLATES, INSPECTIONS, MESSAGES } from "./mockData";

function seed() {
  return {
    vendors: structuredClone(VENDORS),
    orders: structuredClone(ORDERS),
    properties: structuredClone(OWNER_PROPS),
    balances: structuredClone(RESIDENT_BALANCES),
    templates: structuredClone(TEMPLATES),
    inspections: structuredClone(INSPECTIONS),
    messages: structuredClone(MESSAGES),
  };
}

function db() {
  if (!globalThis.__flemingStore) globalThis.__flemingStore = seed();
  return globalThis.__flemingStore;
}

const rid = (prefix, span = 9000, base = 1000) =>
  `${prefix}-${String(Math.floor(Math.random() * span) + base)}`;

export const mockStore = {
  // ── Reads ──────────────────────────────────────────────────────────────────
  listOrders() { return db().orders; },
  listVendors() { return db().vendors; },
  listProperties() { return db().properties; },
  listBalances() { return db().balances; },
  listTemplates() { return db().templates; },
  listInspections() { return db().inspections; },
  messagesFor(role) { return db().messages[role] || []; },

  // Active tenancies for one property, mirroring the live shape so the staff
  // work-order picker behaves identically in demo mode. The seeded balances
  // already describe who lives in which unit, so they are the natural source;
  // lease and tenant ids are synthesised because the mock has no Buildium ids.
  listOccupancy(propertyId) {
    const prop = db().properties.find((p) => String(p.id) === String(propertyId));
    if (!prop) return [];
    return db().balances
      .filter((b) => b.property === prop.name)
      .map((b, i) => ({
        leaseId: Number(`9${prop.id}${i}`),
        unitId: null,
        unitNumber: String(b.unit).replace(/^Unit\s*/i, ""),
        tenantId: Number(`8${prop.id}${i}`),
        tenantName: b.resident,
      }));
  },

  // ── Work-order mutations ────────────────────────────────────────────────────
  createOrder(input) {
    const order = {
      id: input.id || rid("WO"),
      vendorId: null,
      reported: "Just now",
      residentName: null,
      notes: "New work order submitted via app.",
      status: "pending",
      ...input,
    };
    db().orders.unshift(order);
    return order;
  },
  updateOrder(id, patch) {
    const list = db().orders;
    const i = list.findIndex((o) => o.id === id);
    if (i === -1) return null;
    list[i] = { ...list[i], ...patch };
    return list[i];
  },

  // ── Inspection mutations ────────────────────────────────────────────────────
  addInspection(input) {
    const rec = { id: input.id || rid("IN", 900, 100), by: "Marcus J.", date: "Today", ...input };
    db().inspections.unshift(rec);
    return rec;
  },

  // ── Template CRUD ──────────────────────────────────────────────────────────
  createTemplate(input) {
    const tmpl = { id: input.id || rid("t", 100000, 0), items: [], ...input };
    db().templates.push(tmpl);
    return tmpl;
  },
  updateTemplate(id, patch) {
    const list = db().templates;
    const i = list.findIndex((t) => t.id === id);
    if (i === -1) return null;
    list[i] = { ...list[i], ...patch };
    return list[i];
  },
  deleteTemplate(id) {
    const list = db().templates;
    const i = list.findIndex((t) => t.id === id);
    if (i === -1) return false;
    list.splice(i, 1);
    return true;
  },
};
