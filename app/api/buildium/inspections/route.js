import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";

// Record a completed inspection (employee only). The owner sees it read-only.
export async function POST(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (me.role !== "employee") return NextResponse.json({ error: "Employees only." }, { status: 403 });

  const input = await request.json().catch(() => ({}));
  const record = buildium().addInspection({ ...input, by: me.entity?.name || "Employee" });
  return NextResponse.json({ inspection: record });
}
