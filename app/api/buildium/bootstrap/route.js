// One scoped payload the app loads on start. Data is filtered by the caller's role
// server-side, so a resident's browser never receives other residents' orders or
// the portfolio's financials.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";
import { listInspections as listDurableInspections } from "@/lib/inspections";
import { listTemplates as listDurableTemplates } from "@/lib/templates";
import { isBuildiumLive, submissionsReachOffice, assignmentsReachBuildium } from "@/lib/env";
import { ownerScope, inScope, nameInScope } from "@/lib/ownerScope";
import { attachmentsFor, mergeAttachments } from "@/lib/orderAttachments";

// A cold staff load still pages a lot of throttled Buildium requests (measured at
// ~16s before role-scoping the fetches below). The default serverless timeout is
// 10s, which that would exceed. Caches are per-instance, so cold is not rare.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const b = buildium();
  const staff = me.role === "employee";
  const owner = me.role === "owner";
  const portfolio = staff || owner; // who is allowed to see properties/balances/inspections

  // Who is told which vendor is on a job. Naming the contractor costs ~12
  // requests to page Buildium's work orders, so only the roles that are shown
  // it pay for it — a vendor is included because without it they cannot see
  // their own assignments at all.
  const seesVendors = staff || owner || me.role === "vendor";

  // Narrow at the source for residents so their own tickets are never truncated
  // away by the portfolio-wide display cap.
  const scope = {
    ...(me.role === "resident" && me.entity?.tenantId != null ? { residentId: me.entity.tenantId } : {}),
    withVendors: seesVendors,
  };

  // Fetch only what this role is allowed to receive. This used to load
  // everything and filter afterwards, which meant a resident waited on the
  // portfolio sweep — every property and every lease, the single most expensive
  // thing the app does — purely to have it discarded a few lines below. Measured
  // cold, that was the difference between ~16s and a fraction of it.
  //
  // Inspections come from the durable store, not the mock one behind buildium():
  // the mock returns two invented reports ("812 Market St, by Marcus J.") that
  // an owner would read as a real record of their own property.
  const [allOrders, vendors, properties, balances, inspections, templates, myBalance, myOwnerBalance] = await Promise.all([
    me.role === "applicant" ? [] : b.listOrders(scope),
    // The roster only exists to put a name to an assignment, so roles that
    // aren't shown assignments don't need it either.
    seesVendors ? b.listVendors() : [],
    portfolio ? b.listProperties() : [],
    portfolio && !isBuildiumLive() ? b.listBalances() : [],
    portfolio ? listDurableInspections() : [],
    staff ? listDurableTemplates() : [],
    // A resident's own balance. Their unit and address are already in the
    // header, so the lease card can show what they actually owe instead of
    // repeating the unit number back at them.
    me.role === "resident" && me.entity?.leaseId != null
      ? b.leaseBalance(me.entity.leaseId, me.entity?.name)
      : null,
    // An owner's own money. Costs one extra request, and only for the role that
    // is shown it. Null when their account predates owners carrying an id — the
    // profile then says so rather than showing a zero.
    owner && me.entity?.ownerId != null && b.ownerBalance
      ? b.ownerBalance(me.entity.ownerId, me.entity?.propertyIds || [])
      : null,
  ]);

  // An owner sees their own properties only. Until this existed, an owner with
  // one duplex was handed the whole brokerage: every property's rent roll,
  // every resident's tickets and every inspection's interior photos.
  const own = await ownerScope(me, properties);
  const scopedProperties = own ? properties.filter((p) => inScope(own, p.id)) : properties;
  const scopedInspections = own ? inspections.filter((i) => nameInScope(own, i.property)) : inspections;

  let orders;
  if (staff) orders = allOrders;
  else if (owner) orders = own ? allOrders.filter((o) => inScope(own, o.propertyId)) : allOrders;
  else if (me.role === "vendor") orders = allOrders.filter((o) => o.vendorId === me.entity?.vendorId);
  else if (me.role === "resident") {
    // Prefer the stable Buildium tenant id. Name matching exists only for the
    // mock data, whose records carry no id. In live mode a resident with no
    // tenant id sees nothing: the name is free text chosen at signup, so
    // matching on it would let anyone read a real tenant's requests by typing
    // that tenant's name.
    const myId = me.entity?.tenantId;
    const myName = me.entity?.name;
    if (myId != null) orders = allOrders.filter((o) => o.residentId === myId);
    else if (!isBuildiumLive() && myName) orders = allOrders.filter((o) => o.residentName === myName);
    else orders = [];
  }
  else orders = [];

  // Photos and completion notes live with us, not in Buildium. Fetched only
  // for the orders this caller is actually receiving, after role scoping, so
  // the query never touches another person's tickets. If the table is
  // unreachable the orders still load, just without their pictures, and the
  // failure is logged rather than hidden.
  if (orders.length) {
    try { orders = mergeAttachments(orders, await attachmentsFor(orders.map((o) => o.id))); }
    catch (e) { console.error("[bootstrap] order attachments unavailable:", e?.message || e); }
  }

  // The roster only exists to put a name to an assignment, so an owner gets
  // the contractors on their own jobs rather than every vendor on the books.
  const scopedVendors = own
    ? vendors.filter((v) => orders.some((o) => o.vendorId === v.id))
    : vendors;

  return NextResponse.json({
    me,
    orders,
    vendors: scopedVendors,
    properties: staff || owner ? scopedProperties : [],
    // Resident balances are still the seeded mock set — Buildium's lease ledger
    // is not mapped. Serving them in live mode puts invented people with
    // invented debts ("Derek W. owes $1,200") in front of an owner as though it
    // were their rent roll, so live mode gets nothing and the UI says so.
    balances: (staff || owner) && !isBuildiumLive() ? balances : [],
    balancesEnabled: !isBuildiumLive(),
    // The signed-in resident's own balance, from Buildium's outstanding-balance
    // ledger. null means we couldn't determine it — which the UI must say,
    // rather than showing $0.00 to somebody who is in arrears.
    myBalance: me.role === "resident" ? myBalance : null,
    // Never sent to anyone else, and never computed for them either.
    myOwnerBalance: owner ? myOwnerBalance : null,
    // Whether this role is told who is on a job. Residents are not, so their
    // screens must stay silent about it rather than claim "not yet assigned"
    // for a job that does in fact have a contractor booked.
    vendorVisible: seesVendors,
    // The applicant screen is entirely seeded content — a fixed reference
    // number, property, rent and progress timeline. There is no application
    // backend, so in live mode it must not be presented as somebody's real
    // application.
    applicationsEnabled: !isBuildiumLive(),
    inspections: staff || owner ? scopedInspections : [],
    templates: staff ? templates : [],
    // The seeded message threads are demo fiction. Serving them alongside real
    // Buildium data would tell a real resident a vendor is arriving at their unit.
    // There is no message backend yet, so live mode gets an honest empty inbox.
    messages: isBuildiumLive() ? [] : b.messagesFor(me.role),
    messagingEnabled: !isBuildiumLive(),
    // Whether a submitted request genuinely lands in Buildium. Drives the copy so
    // the app never claims maintenance was notified when it wasn't.
    submissionsReachOffice: submissionsReachOffice(),
    // Whether assigning a contractor reaches Buildium, or is only a note inside
    // this app. Separate from the flag above because raising a work order is the
    // one write that can email someone outside the office.
    assignmentsReachBuildium: assignmentsReachBuildium(),
  });
}
