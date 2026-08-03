// Full inspection report: every checklist line with its note and photo path.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { getInspection } from "@/lib/inspections";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!["employee", "owner"].includes(me.role)) {
    return NextResponse.json({ error: "Not permitted." }, { status: 403 });
  }
  const inspection = await getInspection(params.id);
  if (!inspection) return NextResponse.json({ error: "Inspection not found." }, { status: 404 });
  return NextResponse.json({ inspection });
}
