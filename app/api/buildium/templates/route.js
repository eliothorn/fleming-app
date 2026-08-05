// Inspection templates are the company's own checklists, not Buildium data, so
// they come from the durable store rather than through buildium(). They used to
// be held in server memory and were lost on every restart.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { listTemplates, createTemplate } from "@/lib/templates";

async function requireEmployee(request) {
  const me = await getServerUser(request);
  if (!me) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  if (me.role !== "employee") return { error: NextResponse.json({ error: "Employees only." }, { status: 403 }) };
  return { me };
}

export async function GET(request) {
  const { error } = await requireEmployee(request);
  if (error) return error;
  return NextResponse.json({ templates: await listTemplates() });
}

export async function POST(request) {
  const { error } = await requireEmployee(request);
  if (error) return error;
  const input = await request.json().catch(() => ({}));
  if (!String(input.name || "").trim()) {
    return NextResponse.json({ error: "A checklist needs a name." }, { status: 400 });
  }
  return NextResponse.json({ template: await createTemplate(input) });
}
