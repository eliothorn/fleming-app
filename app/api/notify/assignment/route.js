// Tell people a contractor has been booked.
//
// When an employee assigns a vendor, two people care: the resident who reported
// the problem, and the employee who wants a record that it went out. Both are
// emailed through the same Resend account that sends the sign-in links.
//
// The response says exactly who was reached and who was not. A resident with no
// email on file — 91 of the 719 current residents — cannot be told, and the app
// must say so rather than implying everyone was notified.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { buildium } from "@/lib/buildium";
import { sendEmail, wrap, row, emailConfigured } from "@/lib/notify";
import { sendPush, userIdForTenant } from "@/lib/push";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (me.role !== "employee") return NextResponse.json({ error: "Employees only." }, { status: 403 });
  if (!emailConfigured()) {
    return NextResponse.json({ error: "Email isn't configured, so nobody was notified." }, { status: 503 });
  }

  const { orderId, vendorId } = await request.json().catch(() => ({}));
  if (!orderId) return NextResponse.json({ error: "No work order given." }, { status: 400 });

  const b = buildium();
  const orders = await b.listOrders({ withVendors: true });
  const order = orders.find((o) => String(o.id) === String(orderId));
  if (!order) return NextResponse.json({ error: "That work order isn't in view." }, { status: 404 });

  // Which contractor to name.
  //
  // This used to read order.vendorId, which comes from Buildium's own work-order
  // record — i.e. whoever was on the job BEFORE this assignment. Reassigning from
  // one firm to another therefore emailed the resident the name of the outgoing
  // contractor, and a job with nobody on it yet returned 409 even though the
  // employee had just assigned someone. The caller now says who they picked, and
  // it is checked against the live roster so an arbitrary id cannot be named.
  const vendors = await b.listVendors();
  const picked = Number(vendorId);
  const vendor = vendors.find((v) => v.id === (Number.isFinite(picked) && picked > 0 ? picked : order.vendorId));
  if (!vendor) {
    return NextResponse.json(
      { error: vendorId ? "That contractor isn't in the roster." : "No contractor is assigned to that job yet." },
      { status: 409 }
    );
  }

  const where = [order.address, order.unit].filter(Boolean).join(" · ") || "your property";
  const results = [];

  // The resident who raised it.
  const contact = order.residentId != null ? await b.tenantContact(order.residentId) : null;
  if (contact?.email) {
    const r = await sendEmail({
      to: contact.email,
      subject: `A contractor has been assigned — ${order.title}`,
      html: wrap({
        heading: "Someone is coming to look at this",
        intro: `We've assigned a contractor to the request you reported. They'll be in touch to arrange access.`,
        bodyHtml: row("Request", order.title) + row("Property", where) + row("Contractor", vendor.name) +
          (vendor.phone ? row("Their number", vendor.phone) : ""),
        footNote: "If the timing doesn't suit, or nobody has been in touch, call the office and we'll chase it.",
      }),
    });
    results.push({ who: "resident", email: contact.email, ...r });
  } else {
    results.push({
      who: "resident",
      ok: false,
      error: contact
        ? `${contact.name} has no email address on file, so they could not be told.`
        : "This request isn't linked to a resident record, so nobody could be told.",
    });
  }

  // The employee who did it.
  if (me.email) {
    const r = await sendEmail({
      to: me.email,
      subject: `Assigned: ${vendor.name} — ${order.title}`,
      html: wrap({
        heading: "Assignment confirmed",
        intro: `You assigned this job. ${contact?.email ? "The resident has been emailed." : "The resident could NOT be emailed — see below."}`,
        bodyHtml: row("Work order", order.id) + row("Request", order.title) + row("Property", where) +
          row("Contractor", vendor.name) +
          row("Resident notified", contact?.email ? contact.email : "No — no email on file"),
      }),
    });
    results.push({ who: "employee", email: me.email, ...r });
  }

  // And a push, if the resident has the app installed and has switched them on.
  // Email stays the primary channel — most residents have never signed in — so a
  // push is an extra, never a replacement, and its failure changes nothing.
  let pushed = { sent: 0 };
  try {
    const uid = await userIdForTenant(order.residentId);
    if (uid) {
      pushed = await sendPush(uid, {
        title: "A contractor is coming",
        body: `${vendor.name} has been assigned to your request: ${order.title}`,
        url: "/app",
        tag: `order-${order.id}`,
      });
    }
  } catch { /* never let a notification break the notification route */ }

  const notified = results.filter((r) => r.ok).map((r) => r.who);
  return NextResponse.json({
    ok: notified.length > 0,
    notified,
    results,
    residentReached: Boolean(contact?.email && results.find((r) => r.who === "resident")?.ok),
    pushedToDevices: pushed.sent || 0,
  });
}
