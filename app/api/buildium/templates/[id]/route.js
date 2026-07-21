import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";

async function requireEmployee(request) {
  const me = await getServerUser(request);
  if (!me) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  if (me.role !== "employee") return { error: NextResponse.json({ error: "Employees only." }, { status: 403 }) };
  return { me };
}

export async function PATCH(request, { params }) {
  const { error } = await requireEmployee(request);
  if (error) return error;
  const patch = await request.json().catch(() => ({}));
  const template = buildium().updateTemplate(params.id, patch);
  if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  return NextResponse.json({ template });
}

export async function DELETE(request, { params }) {
  const { error } = await requireEmployee(request);
  if (error) return error;
  const ok = buildium().deleteTemplate(params.id);
  if (!ok) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
