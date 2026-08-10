// Send a completed inspection report out by email.
//
// Goes to two places: a group address the office nominates, and the owner of the
// property that was inspected — looked up from Buildium rather than typed, so it
// reaches the right person without anyone having to remember who owns what.
//
// Photos live in a PRIVATE bucket, so the report embeds time-limited signed URLs
// rather than making anything public. They are minted for 7 days: long enough
// for an owner to open the mail over a weekend, short enough that a forwarded
// message stops working.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { getInspection } from "@/lib/inspections";
import { getAdminSupabase } from "@/lib/auth/supabase";
import { buildium } from "@/lib/buildium";
import { sendEmail, wrap, row, emailConfigured } from "@/lib/notify";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BUCKET = "fleming-photos";
const LINK_TTL_SECONDS = 60 * 60 * 24 * 7;

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function POST(request, { params }) {
  const me = await getServerUser(request);
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (me.role !== "employee") return NextResponse.json({ error: "Employees only." }, { status: 403 });
  if (!emailConfigured()) {
    return NextResponse.json({ error: "Email isn't configured, so the report can't be sent." }, { status: 503 });
  }

  const report = await getInspection(params.id);
  if (!report) return NextResponse.json({ error: "That report no longer exists." }, { status: 404 });

  const body = await request.json().catch(() => ({}));

  // Recipients: whatever the caller nominates, plus the office group address,
  // plus the property's owner if we can identify them.
  const groupAddress = process.env.INSPECTION_REPORT_TO || "";
  const recipients = [...String(body.to || "").split(/[,;\s]+/), ...groupAddress.split(/[,;\s]+/)].filter(Boolean);

  const ownerNotes = [];
  if (body.includeOwner !== false) {
    try {
      const props = await buildium().listProperties();
      const match = props.find((p) => p.name && report.property && p.name.trim().toLowerCase() === String(report.property).trim().toLowerCase());
      if (match) {
        const owners = await buildium().ownersFor(match.id);
        owners.forEach((o) => { recipients.push(o.email); ownerNotes.push(`${o.name} <${o.email}>`); });
        if (!owners.length) ownerNotes.push("No owner with an email is linked to this property in Buildium.");
      } else {
        ownerNotes.push(`Couldn't match "${report.property}" to a property record, so no owner was added.`);
      }
    } catch {
      ownerNotes.push("Owner lookup failed, so no owner was added.");
    }
  }

  if (!recipients.length) {
    return NextResponse.json(
      { error: "No recipient. Set INSPECTION_REPORT_TO, or pass an address." },
      { status: 400 }
    );
  }

  // Signed links for the evidence photos.
  const admin = getAdminSupabase();
  const withPhotos = [];
  for (const item of report.items || []) {
    let url = null;
    if (item.photoPath) {
      const { data } = await admin.storage.from(BUCKET).createSignedUrl(item.photoPath, LINK_TTL_SECONDS);
      url = data?.signedUrl || null;
    }
    withPhotos.push({ ...item, url });
  }

  const failed = withPhotos.filter((i) => i.result === "fail");
  const passed = withPhotos.filter((i) => i.result === "pass");

  const itemHtml = (i) => `
    <div style="border:1px solid ${i.result === "fail" ? "#FECACA" : "#E5E1D8"};background:${i.result === "fail" ? "#FEF2F2" : "#FAF8F4"};border-radius:10px;padding:11px 13px;margin-bottom:9px;">
      <div style="font-size:14px;font-weight:700;color:${i.result === "fail" ? "#B91C1C" : "#0D1B33"};">
        ${esc(i.label)}${i.critical ? ' <span style="font-size:10px;letter-spacing:.06em;">· CRITICAL</span>' : ""}
      </div>
      <div style="font-size:11.5px;color:#8A93A5;margin-top:2px;">${esc(i.category || "General")}</div>
      ${i.note ? `<div style="font-size:13px;color:#0D1B33;margin-top:7px;line-height:1.5;">${esc(i.note)}</div>` : ""}
      ${i.url ? `<div style="margin-top:9px;"><img src="${i.url}" alt="" style="max-width:100%;border-radius:8px;border:1px solid #E5E1D8;" /></div>` : ""}
    </div>`;

  const html = wrap({
    heading: `Inspection — ${esc(report.property)}`,
    intro: `${esc(report.scope || "Inspection")} carried out by ${esc(report.by || "the office")}${report.date ? ` on ${esc(report.date)}` : ""}.`,
    bodyHtml:
      row("Passed", String(report.passed ?? passed.length)) +
      row("Flagged", String(report.failed ?? failed.length)) +
      (report.nextDate ? row("Next inspection", esc(report.nextDate)) : "") +
      (failed.length
        ? `<div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#B91C1C;margin:16px 0 8px;">Needs attention</div>${failed.map(itemHtml).join("")}`
        : `<div style="font-size:13.5px;color:#15803D;font-weight:600;margin:14px 0 8px;">Nothing was flagged on this inspection.</div>`) +
      (passed.length
        ? `<div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8A93A5;margin:16px 0 8px;">Passed (${passed.length})</div>
           <div style="font-size:13px;color:#4A6A80;line-height:1.7;">${passed.map((i) => esc(i.label)).join("<br>")}</div>`
        : ""),
    footNote: "Photo links in this email expire after seven days. Reply to this message to reach the office.",
  });

  const sent = await sendEmail({
    to: recipients,
    subject: `Inspection report — ${report.property}`,
    html,
    replyTo: me.email || undefined,
  });

  if (!sent.ok) return NextResponse.json({ error: sent.error, ownerNotes }, { status: 502 });
  return NextResponse.json({ ok: true, sentTo: sent.sentTo, ownerNotes });
}
