// One scoped payload the app loads on start. Data is filtered by the caller's role
// server-side, so a resident's browser never receives other residents' orders or
// the portfolio's financials.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";

export async function GET(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const b = buildium();
  const [allOrders, vendors, properties, balances, inspections, templates] = await Promise.all([
    b.listOrders(), b.listVendors(), b.listProperties(), b.listBalances(), b.listInspections(), b.listTemplates(),
  ]);

  const staff = me.role === "employee";
  const owner = me.role === "owner";

  let orders;
  if (staff || owner) orders = allOrders;
  else if (me.role === "vendor") orders = allOrders.filter((o) => o.vendorId === me.entity?.vendorId);
  else if (me.role === "resident") orders = allOrders.filter((o) => o.residentName === me.entity?.name);
  else orders = [];

  return NextResponse.json({
    me,
    orders,
    vendors,
    properties: staff || owner ? properties : [],
    balances: staff || owner ? balances : [],
    inspections: staff || owner ? inspections : [],
    templates: staff ? templates : [],
    messages: b.messagesFor(me.role),
  });
}
