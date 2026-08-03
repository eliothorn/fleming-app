// Inspection records. Employees create and read; owners read only — they see
// completed inspections but do not manage them.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { listInspections, createInspection } from "@/lib/inspections";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!["employee", "owner"].includes(me.role)) {
    return NextResponse.json({ error: "Not permitted." }, { status: 403 });
  }
  return NextResponse.json({ inspections: await listInspections() });
}

export async function POST(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (me.role !== "employee") {
    return NextResponse.json({ error: "Employees only." }, { status: 403 });
  }
  const input = await request.json().catch(() => ({}));
  if (!input.property) {
    return NextResponse.json({ error: "An inspection needs a property." }, { status: 400 });
  }
  const inspection = await createInspection(input, me);
  return NextResponse.json({ inspection });
}
