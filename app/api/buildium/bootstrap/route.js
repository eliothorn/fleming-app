// One scoped payload the app loads on start. Data is filtered by the caller's role
// server-side, so a resident's browser never receives other residents' orders or
// the portfolio's financials.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";
import { isBuildiumLive } from "@/lib/env";

export async function GET(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const b = buildium();
  // Narrow at the source for residents so their own tickets are never truncated
  // away by the portfolio-wide display cap.
  const scope = me.role === "resident" && me.entity?.tenantId != null ? { residentId: me.entity.tenantId } : {};
  const [allOrders, vendors, properties, balances, inspections, templates] = await Promise.all([
    b.listOrders(scope), b.listVendors(), b.listProperties(), b.listBalances(), b.listInspections(), b.listTemplates(),
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
    balances: staff || owner ? balances : [],
    inspections: staff || owner ? inspections : [],
    templates: staff ? templates : [],
    // The seeded message threads are demo fiction. Serving them alongside real
    // Buildium data would tell a real resident a vendor is arriving at their unit.
    // There is no message backend yet, so live mode gets an honest empty inbox.
    messages: isBuildiumLive() ? [] : b.messagesFor(me.role),
    messagingEnabled: !isBuildiumLive(),
    // Buildium writes are not implemented, so in live mode a submitted request is
    // recorded locally and does NOT reach the office. The UI must say so rather
    // than tell a resident maintenance has been notified.
    submissionsReachOffice: !isBuildiumLive(),
  });
}
