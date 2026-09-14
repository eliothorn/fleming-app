// Full inspection report: every checklist line with its note and photo path.
// An owner may open a report only for a property they own; anything else is
// reported as not found rather than forbidden, so ids cannot be enumerated.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";
import { getInspection } from "@/lib/inspections";
import { ownerScope, nameInScope } from "@/lib/ownerScope";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!["employee", "owner"].includes(me.role)) {
    return NextResponse.json({ error: "Not permitted." }, { status: 403 });
  }
  const inspection = await getInspection(params.id);
  if (!inspection) return NextResponse.json({ error: "Inspection not found." }, { status: 404 });
  const scope = await ownerScope(me, me.role === "owner" ? await buildium().listProperties() : []);
  if (scope && !nameInScope(scope, inspection.property)) {
    return NextResponse.json({ error: "Inspection not found." }, { status: 404 });
  }
  return NextResponse.json({ inspection });
}
