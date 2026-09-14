// Inspection records. Employees create and read; owners read only — they see
// completed inspections for their own properties and nothing else.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";
import { listInspections, createInspection } from "@/lib/inspections";
import { ownerScope, nameInScope } from "@/lib/ownerScope";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!["employee", "owner"].includes(me.role)) {
    return NextResponse.json({ error: "Not permitted." }, { status: 403 });
  }
  let inspections = await listInspections();
  // Inspections are stored by property name, so an owner's list is narrowed
  // by the names of the properties they own. The property list is cached.
  const scope = await ownerScope(me, me.role === "owner" ? await buildium().listProperties() : []);
  if (scope) inspections = inspections.filter((i) => nameInScope(scope, i.property));
  return NextResponse.json({ inspections });
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
