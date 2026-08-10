// Send a property owner an update on their property.
//
// The "Owner report" button used to navigate to the Profile screen and do
// nothing, which promised something the app could not deliver. This makes it
// real: a short, accurate summary of one property, emailed to whoever Buildium
// records as its owner.
//
// Everything in it comes from live data. Where a figure isn't available it is
// omitted rather than estimated — an owner acting on an invented occupancy
// number is worse than an owner having to ring the office.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";
import { listInspections } from "@/lib/inspections";
import { sendEmail, wrap, row, emailConfigured } from "@/lib/notify";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Who owns what, so the employee can choose before sending.
export async function GET(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (me.role !== "employee") return NextResponse.json({ error: "Employees only." }, { status: 403 });

  try {
    const props = await buildium().listProperties();
    const withOwners = [];
    for (const p of props) {
      const owners = await buildium().ownersFor(p.id);
      if (owners.length) withOwners.push({ id: p.id, name: p.name, owners });
    }
    return NextResponse.json({
      properties: withOwners.sort((a, b) => String(a.name).localeCompare(String(b.name))),
      total: props.length,
      reachable: withOwners.length,
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Could not load owners." }, { status: 502 });
  }
}

export async function POST(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (me.role !== "employee") return NextResponse.json({ error: "Employees only." }, { status: 403 });
  if (!emailConfigured()) {
    return NextResponse.json({ error: "Email isn't configured, so nothing was sent." }, { status: 503 });
  }

  const { propertyId, note } = await request.json().catch(() => ({}));
  if (propertyId == null) return NextResponse.json({ error: "Choose a property first." }, { status: 400 });

  const b = buildium();
  const props = await b.listProperties();
  const property = props.find((p) => String(p.id) === String(propertyId));
  if (!property) return NextResponse.json({ error: "That property isn't in view." }, { status: 404 });

  const owners = await b.ownersFor(property.id);
  if (!owners.length) {
    return NextResponse.json(
      { error: `No owner with an email address is linked to ${property.name} in Buildium.` },
      { status: 409 }
    );
  }

  const orders = await b.listOrders({ withVendors: true });
  const mine = orders.filter((o) => o.address === property.name);
  const open = mine.filter((o) => o.status !== "done");
  const vendors = await b.listVendors();
  const vname = (id) => vendors.find((v) => v.id === id)?.name || null;

  const inspections = (await listInspections()).filter(
    (i) => String(i.property || "").trim().toLowerCase() === String(property.name).trim().toLowerCase()
  );

  const jobHtml = open.slice(0, 12).map((o) => `
    <div style="border:1px solid #E5E1D8;background:#FAF8F4;border-radius:10px;padding:10px 12px;margin-bottom:8px;">
      <div style="font-size:13.5px;font-weight:700;color:#0D1B33;">${esc(o.title)}</div>
      <div style="font-size:11.5px;color:#8A93A5;margin-top:2px;">
        ${esc([o.unit, o.reported].filter(Boolean).join(" · "))}
        ${vname(o.vendorId) ? ` · ${esc(vname(o.vendorId))}` : " · not yet assigned"}
      </div>
    </div>`).join("");

  const html = wrap({
    heading: `Update on ${esc(property.name)}`,
    intro: note
      ? esc(note)
      : "Here's where things stand at your property. Figures come straight from our management system.",
    bodyHtml:
      row("Units", `${property.occupied}/${property.units} occupied`) +
      (property.monthlyRev && property.monthlyRev !== "—" ? row("Monthly rent roll", esc(property.monthlyRev)) : "") +
      row("Open work orders", String(open.length)) +
      (property.urgentOrders ? row("Marked urgent", String(property.urgentOrders)) : "") +
      row("Inspections on file", String(inspections.length)) +
      (open.length
        ? `<div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8A93A5;margin:16px 0 8px;">Open work${open.length > 12 ? ` — showing 12 of ${open.length}` : ""}</div>${jobHtml}`
        : `<div style="font-size:13.5px;color:#15803D;font-weight:600;margin:14px 0 4px;">No open work orders at this property.</div>`),
    footNote: "Reply to this email to reach the office directly.",
  });

  const sent = await sendEmail({
    to: owners.map((o) => o.email),
    subject: `${property.name} — owner update`,
    html,
    replyTo: me.email || undefined,
  });

  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 502 });
  return NextResponse.json({
    ok: true,
    sentTo: sent.sentTo,
    owners: owners.map((o) => o.name),
    property: property.name,
  });
}
