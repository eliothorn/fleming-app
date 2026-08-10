// The conversation on one work order.
//
// Buildium keeps the back-and-forth in the task's history rather than in a
// separate inbox, which is the right model: a message about a leak belongs to
// the leak, not to a general thread.
//
// Access is checked against the SAME scoped list the app shows, so a resident
// can only read the thread of a request that is genuinely theirs, and a vendor
// only one assigned to them. Fetching history for an arbitrary id would
// otherwise expose other residents' correspondence.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const orderId = String(params.id || "");
  if (!orderId) return NextResponse.json({ error: "No work order given." }, { status: 400 });

  const b = buildium();
  const staff = me.role === "employee";
  const owner = me.role === "owner";
  const seesVendors = staff || owner || me.role === "vendor";

  try {
    // Re-derive what this person is allowed to see, rather than trusting the id.
    const scope = {
      ...(me.role === "resident" && me.entity?.tenantId != null ? { residentId: me.entity.tenantId } : {}),
      withVendors: seesVendors,
    };
    const all = await b.listOrders(scope);

    let visible = all;
    if (me.role === "vendor") visible = all.filter((o) => o.vendorId === me.entity?.vendorId);
    else if (me.role === "resident") {
      const myId = me.entity?.tenantId;
      const myName = me.entity?.name;
      visible = all.filter((o) =>
        myId != null && o.residentId != null ? o.residentId === myId : Boolean(myName) && o.residentName === myName
      );
    } else if (!staff && !owner) visible = [];

    if (!visible.some((o) => String(o.id) === orderId)) {
      return NextResponse.json({ error: "Not permitted." }, { status: 403 });
    }

    return NextResponse.json({ messages: (await b.orderMessages(orderId)) || [] });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Could not load the conversation." }, { status: 502 });
  }
}
