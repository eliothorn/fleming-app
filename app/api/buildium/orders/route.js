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
  // Residents can only file against their own unit — enforce identity server-side.
  if (me.role === "resident") {
    input.residentName = me.entity?.name || null;
    if (me.entity?.unit && me.entity.unit !== "Pending assignment") input.unit = me.entity.unit;
    if (me.entity?.address && me.entity.address !== "—") input.address = me.entity.address;
  }
  const order = buildium().createOrder(input);
  return NextResponse.json({ order });
}
