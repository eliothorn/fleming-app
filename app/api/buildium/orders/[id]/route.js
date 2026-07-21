import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";

// Update a work order: assign a vendor, mark vendor-complete, close out, etc.
export async function PATCH(request, { params }) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!["employee", "vendor"].includes(me.role)) {
    return NextResponse.json({ error: "Not permitted to modify work orders." }, { status: 403 });
  }

  const patch = await request.json().catch(() => ({}));
  const order = buildium().updateOrder(params.id, patch);
  if (!order) return NextResponse.json({ error: "Work order not found." }, { status: 404 });
  return NextResponse.json({ order });
}
