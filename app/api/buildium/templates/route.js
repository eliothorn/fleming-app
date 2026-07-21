import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";

async function requireEmployee(request) {
  const me = await getServerUser(request);
  if (!me) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  if (me.role !== "employee") return { error: NextResponse.json({ error: "Employees only." }, { status: 403 }) };
  return { me };
}

export async function GET(request) {
  const { error } = await requireEmployee(request);
  if (error) return error;
  return NextResponse.json({ templates: buildium().listTemplates() });
}

export async function POST(request) {
  const { error } = await requireEmployee(request);
  if (error) return error;
  const input = await request.json().catch(() => ({}));
  return NextResponse.json({ template: buildium().createTemplate(input) });
}
