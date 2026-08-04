// One scoped payload the app loads on start. Data is filtered by the caller's role
// server-side, so a resident's browser never receives other residents' orders or
// the portfolio's financials.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";
import { listInspections as listDurableInspections } from "@/lib/inspections";
import { isBuildiumLive, submissionsReachOffice } from "@/lib/env";

// A cold load pages ~30 throttled Buildium requests and takes ~9s. The default
// serverless timeout is 10s, which this would intermittently exceed.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const b = buildium();
  // Narrow at the source for residents so their own tickets are never truncated
  // away by the portfolio-wide display cap.
  const scope = me.role === "resident" && me.entity?.tenantId != null ? { residentId: me.entity.tenantId } : {};
  // Inspections come from the durable store, not the mock one behind buildium():
  // the mock returns two invented reports ("812 Market St, by Marcus J.") that
  // an owner would read as a real record of their own property.
  const [allOrders, vendors, properties, balances, inspections, templates] = await Promise.all([
    b.listOrders(scope), b.listVendors(), b.listProperties(), b.listBalances(), listDurableInspections(), b.listTemplates(),
  ]);

  const staff = me.role === "employee";
  const owner = me.role === "owner";

  let orders;
  if (staff || owner) orders = allOrders;
  else if (me.role === "vendor") orders = allOrders.filter((o) => o.vendorId === me.entity?.vendorId);
  else if (me.role === "resident") {
    // Prefer the stable Buildium tenant id; fall back to name only for records that
    // carry no id (e.g. mock data), since name matching breaks on middle initials.
    const myId = me.entity?.tenantId;
    const myName = me.entity?.name;
    orders = allOrders.filter((o) =>
      (myId != null && o.residentId != null)
        ? o.residentId === myId
        : Boolean(myName) && o.residentName === myName
    );
  }
  else orders = [];

  return NextResponse.json({
    me,
    orders,
    vendors,
    properties: staff || owner ? properties : [],
    // Resident balances are still the seeded mock set — Buildium's lease ledger
    // is not mapped. Serving them in live mode puts invented people with
    // invented debts ("Derek W. owes $1,200") in front of an owner as though it
    // were their rent roll, so live mode gets nothing and the UI says so.
    balances: (staff || owner) && !isBuildiumLive() ? balances : [],
    balancesEnabled: !isBuildiumLive(),
    // The applicant screen is entirely seeded content — a fixed reference
    // number, property, rent and progress timeline. There is no application
    // backend, so in live mode it must not be presented as somebody's real
    // application.
    applicationsEnabled: !isBuildiumLive(),
    inspections: staff || owner ? inspections : [],
    templates: staff ? templates : [],
    // The seeded message threads are demo fiction. Serving them alongside real
    // Buildium data would tell a real resident a vendor is arriving at their unit.
    // There is no message backend yet, so live mode gets an honest empty inbox.
    messages: isBuildiumLive() ? [] : b.messagesFor(me.role),
    messagingEnabled: !isBuildiumLive(),
    // Whether a submitted request genuinely lands in Buildium. Drives the copy so
    // the app never claims maintenance was notified when it wasn't.
    submissionsReachOffice: submissionsReachOffice(),
  });
}
