// In-memory mock store. Seeded from mockData; survives Next.js hot reloads via
// globalThis so created work orders / inspections / templates persist during a
// dev session. Resets on full server restart (fine for a mock backend).

import { VENDORS, ORDERS, OWNER_PROPS, RESIDENT_BALANCES, TEMPLATES, INSPECTIONS, MESSAGES } from "./mockData.js";

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

  // Demo mode has no real photography, and inventing one would put a building
  // that isn't theirs on a property card. The UI falls back to a typographic
  // tile, which is the same thing live mode shows for the ~40% of real
  // properties with no photo on file.
  propertyImageUrl() { return null; },

  // Active tenancies for one property, mirroring the live shape so the staff
  // work-order picker behaves identically in demo mode. The seeded balances
  // already describe who lives in which unit, so they are the natural source;
  // lease and tenant ids are synthesised because the mock has no Buildium ids.
  // Demo-mode equivalent of the live lease balance, so the resident screen
  // behaves the same without Buildium. Seeded balances are keyed by resident
  // name rather than lease id, so match on that.
  leaseBalance(leaseId, name) {
    const row = db().balances.find((b) => b.resident === name);
    const total = row ? Number(row.balance) || 0 : 0;
    return { total, current: total, over30: 0, over60: 0, over90: 0 };
  },

  // Demo-mode equivalents so these screens behave the same without Buildium.
  listVacancies() {
    return db().properties.slice(0, 3).map((p, i) => ({
      id: 9000 + i,
      propertyId: p.id,
      property: p.name,
      unit: String(i + 1),
      rent: 950 + i * 275,
      beds: ["1 bed", "2 bed", "3 bed"][i] || null,
      baths: "1",
      size: null,
      description: null,
      address: p.name,
    }));
  },
  ownersFor() { return []; },

  // Demo-mode owner balance, shaped exactly like the live one so the profile
  // screen has a single code path. Derived from the seeded properties' rent so
  // the number moves with the rest of the demo rather than being a magic figure.
  ownerBalance() {
    const props = db().properties;
    const held = props.reduce((sum, p) => sum + (Number(String(p.monthlyRev).replace(/[^0-9.]/g, "")) || 0), 0);
    const reserve = props.length * 300;
    return {
      held,
      reserve,
      available: held - reserve,
      asOf: new Date().toISOString().slice(0, 10),
      properties: props.length,
      accounts: [{ name: "Operating Account", balance: held }],
      reserveCountedOn: props.length,
    };
  },
  orderMessages() { return []; },
  tenantContact() { return null; },

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
  // Mirrors the live client's separate vendor-assignment write, so demo mode and
  // live mode expose the same surface and the Proxy never has to fall through to
  // a method that means something different here.
  assignVendor(id, vendorId) {
    return mockStore.updateOrder(String(id).startsWith("WO-") ? String(id) : `WO-${id}`, { vendorId });
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
