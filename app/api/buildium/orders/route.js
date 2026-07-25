import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";

// Create a work order. Residents may submit their own; employees may log any.
export async function POST(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!["employee", "resident"].includes(me.role)) {
    return NextResponse.json({ error: "Not permitted to create work orders." }, { status: 403 });
  }

  const input = await request.json().catch(() => ({}));
  // Residents can only file against their own unit — identity comes from the
  // session, never from the request body.
  if (me.role === "resident") {
    input.residentName = me.entity?.name || null;
    input.residentId = me.entity?.tenantId ?? null;
    input.leaseId = me.entity?.leaseId ?? null;
    if (me.entity?.unit && me.entity.unit !== "Pending assignment") input.unit = me.entity.unit;
    if (me.entity?.address && !["—", "-"].includes(me.entity.address)) input.address = me.entity.address;
  }

  try {
    const order = await buildium().createOrder(input);
    return NextResponse.json({ order });
  } catch (e) {
    // A resident whose account isn't linked to a lease can't have a ticket filed
    // for them — say so plainly instead of failing silently.
    const status = e?.code === "BUILDIUM_IDENTITY_REQUIRED" ? 409 : 502;
    return NextResponse.json({ error: e?.message || "Could not create the work order." }, { status });
  }
}
