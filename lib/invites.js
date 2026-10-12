// The resident rollout: who has been invited, who has signed in, and the
// invitation itself.
//
// The app being on the App Store is not the same as residents using it. Left to
// word of mouth, a property app lands around 12% adoption; the difference is
// made by someone actually emailing every resident and then being able to see
// what happened. This is that, and the counts it returns are the only honest
// answer to "did the rollout work".
//
// See supabase/resident-invites.sql. Like the inspection store and unlike the
// order attachments, this falls back to memory when Supabase is absent, because
// without Supabase there is no email to send either and the whole screen is a
// demo of itself.
import { isSupabaseConfigured } from "./env";
import { getAdminSupabase } from "./auth/supabase";
import { sendEmail, wrap, emailConfigured } from "./notify";

const TABLE = "resident_invites";
const mem = () => (globalThis.__flResidentInvites ||= new Map());

const OFFICE_PHONE = "717-774-7791";

// Where the invitation sends people. Until the app is approved there is nothing
// to link to on the App Store, so the email points at the website and quietly
// gains the store button the day APP_STORE_URL is set. That ordering matters:
// a dead App Store link in 600 inboxes cannot be taken back.
const appStoreUrl = () => String(process.env.APP_STORE_URL || "").trim() || null;
const siteUrl = () =>
  String(process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "") || "https://www.flemingrealty.org";

// ---- who has been invited ---------------------------------------------------

// email -> { invited_at, error }. A row with an error is a FAILED send, so it
// does not count as invited and will be retried in the next batch.
export async function invitedMap() {
  const out = new Map();
  if (!isSupabaseConfigured()) {
    for (const [k, v] of mem()) out.set(k, v);
    return out;
  }
  const { data, error } = await getAdminSupabase()
    .from(TABLE).select("email, invited_at, error, property_id");
  if (error) throw new Error(`Could not read the invitation list: ${error.message}`);
  for (const r of data || []) out.set(r.email, r);
  return out;
}

// Which invited addresses have actually become accounts. This is the number
// that says whether the rollout worked; everything else says it was attempted.
export async function signedUpSet(emails) {
  const out = new Set();
  const list = [...new Set(emails)].filter(Boolean);
  if (!list.length || !isSupabaseConfigured()) return out;
  // Chunked: a 600-address `in` filter is a URL long enough to be refused.
  for (let i = 0; i < list.length; i += 200) {
    const { data, error } = await getAdminSupabase()
      .from("profiles").select("email").in("email", list.slice(i, i + 200));
    if (error) throw new Error(`Could not read sign-ups: ${error.message}`);
    for (const r of data || []) out.add(String(r.email || "").toLowerCase());
  }
  return out;
}

async function record(row) {
  if (!isSupabaseConfigured()) { mem().set(row.email, row); return; }
  // Upsert, so a retry after a failed send replaces the failure rather than
  // colliding with it.
  const { error } = await getAdminSupabase().from(TABLE).upsert(row, { onConflict: "email" });
  if (error) throw new Error(`Could not record the invitation: ${error.message}`);
}

// ---- the invitation ---------------------------------------------------------

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const button = (href, label, primary = true) => `
<a href="${esc(href)}" style="display:inline-block;padding:13px 22px;border-radius:24px;font-size:14.5px;font-weight:700;text-decoration:none;margin:0 8px 8px 0;${
  primary ? "background:#0D1B33;color:#ffffff;" : "background:#ffffff;color:#0D1B33;border:1px solid #E5E1D8;"
}">${esc(label)}</a>`;

// Named property and unit, and the address it was sent to, because a resident
// who cannot tell this from phishing will not tap anything in it. That is the
// single biggest reason rollout emails fail, and it costs two lines to fix.
export function inviteEmail(resident) {
  const store = appStoreUrl();
  const site = siteUrl();
  const where = [resident.property, resident.unit].filter(Boolean).join(", ");

  return {
    subject: "Your maintenance requests, from your phone",
    html: wrap({
      heading: `${resident.name.split(" ")[0] || "Hello"}, your home now has an app`,
      intro: `Stephen Fleming Realty has put ${
        where ? `<b>${esc(where)}</b>` : "your home"
      } on an app, so you can report a repair without ringing the office and watch what happens next.`,
      bodyHtml: `
<div style="font-size:14px;line-height:1.7;color:#0D1B33;margin-bottom:18px;">
  <div style="margin-bottom:7px;">· Report a problem in a few taps, with a photo</div>
  <div style="margin-bottom:7px;">· See it move from reported, to scheduled, to done</div>
  <div style="margin-bottom:7px;">· Check your lease dates and your balance any time</div>
</div>
<div style="margin-bottom:6px;">
  ${store ? button(store, "Get the app") : ""}
  ${button(`${site}/login`, store ? "Open in a browser" : "Open the app", !store)}
</div>`,
      footNote: `Sign in with this email address, <b>${esc(resident.email)}</b>, and we will send you a one-tap link. There is no password to make up.<br><br>
This is a real message from Stephen Fleming Realty, your property manager. For anything urgent, please still call the office on ${OFFICE_PHONE}.`,
    }),
  };
}

// ---- sending ----------------------------------------------------------------

// One batch. Sequential on purpose: the provider rate-limits, and a rollout that
// trips the limit halfway leaves nobody able to say who actually got an email.
export async function sendInvites({ residents, by }) {
  if (!emailConfigured()) {
    return { sent: 0, failed: 0, results: [], error: "Email isn't configured on this deployment." };
  }
  const results = [];
  let sent = 0, failed = 0;

  for (const r of residents) {
    const { subject, html } = inviteEmail(r);
    const res = await sendEmail({ to: r.email, subject, html });
    try {
      await record({
        email: r.email,
        tenant_id: r.tenantId ?? null,
        name: r.name || null,
        unit: r.unit || null,
        property_id: r.propertyId ?? null,
        property: r.property || null,
        invited_at: new Date().toISOString(),
        invited_by: by || null,
        provider_id: res.ok ? res.id || null : null,
        error: res.ok ? null : String(res.error || "Send failed").slice(0, 500),
      });
    } catch {
      // The email went out; losing the record is worse than it sounds, so say
      // so rather than reporting a clean send we cannot prove.
      results.push({ email: r.email, ok: false, error: "Sent, but we couldn't record it. Do not re-send this batch." });
      failed++;
      continue;
    }
    if (res.ok) { sent++; results.push({ email: r.email, ok: true }); }
    else { failed++; results.push({ email: r.email, ok: false, error: res.error }); }
  }
  return { sent, failed, results };
}
