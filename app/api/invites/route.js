// The resident rollout, employee-gated.
//
// GET  — who can be invited, who has been, who signed in. Per property too, so
//        a pilot can be picked on real numbers.
// POST — send one batch, skipping anyone already invited.
//
// Employee only, and deliberately not reachable by a resident, an owner or a
// vendor: this endpoint lists every resident's email address in the portfolio.
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/session";
import { isBuildiumLive } from "@/lib/env";
import { residentRoster } from "@/lib/residents";
import { invitedMap, signedUpSet, sendInvites, inviteEmail } from "@/lib/invites";
import { emailConfigured, sendEmail } from "@/lib/notify";

// Paging Buildium plus a batch of sends is well past the 10s default.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// The provider's free tier allows 100 messages a day. Sending more does not
// fail loudly, it fails per-message partway through, which is the worst way to
// discover a limit. The cap is enforced here rather than trusted to the caller.
const DAILY_CAP = 100;

async function employee(request) {
  const me = await getServerUser(request);
  if (!me) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  if (me.role !== "employee") {
    return { error: NextResponse.json({ error: "Only the office can send invitations." }, { status: 403 }) };
  }
  return { me };
}

// Shared by both verbs: the roster, cross-referenced with what has been sent.
async function audience() {
  const { residents, properties, counts } = await residentRoster();
  const invited = await invitedMap();
  const signedUp = await signedUpSet(residents.map((r) => r.email));

  const state = (r) => {
    const row = invited.get(r.email);
    if (signedUp.has(r.email)) return "joined";
    if (row && !row.error) return "invited";
    if (row && row.error) return "failed";
    return "new";
  };

  const tally = { new: 0, invited: 0, joined: 0, failed: 0 };
  const byProperty = new Map(properties.map((p) => [p.id, { ...p, new: 0, invited: 0, joined: 0, failed: 0 }]));
  for (const r of residents) {
    const s = state(r);
    tally[s]++;
    const p = byProperty.get(r.propertyId);
    if (p) p[s]++;
  }

  return { residents, state, tally, counts, properties: [...byProperty.values()] };
}

export async function GET(request) {
  const gate = await employee(request);
  if (gate.error) return gate.error;

  if (!isBuildiumLive()) {
    return NextResponse.json({ error: "The resident list comes from Buildium, which isn't live on this deployment." }, { status: 409 });
  }

  try {
    const { tally, counts, properties } = await audience();
    return NextResponse.json({
      counts,                 // current / reachable / withoutEmail, from Buildium
      tally,                  // new / invited / joined / failed
      properties: properties.sort((a, b) => b.reachable - a.reachable),
      dailyCap: DAILY_CAP,
      emailReady: emailConfigured(),
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Couldn't load the resident list." }, { status: 502 });
  }
}

export async function POST(request) {
  const gate = await employee(request);
  if (gate.error) return gate.error;

  if (!isBuildiumLive()) {
    return NextResponse.json({ error: "The resident list comes from Buildium, which isn't live on this deployment." }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));

  // Send one to yourself first. Nobody should discover a broken link or a
  // typo'd greeting in 619 inboxes, and an employee is never in the resident
  // roster, so without this there is no way to see the thing before it ships.
  // Records nothing: this is not an invitation, it is a proof.
  if (body.preview) {
    if (!emailConfigured()) {
      return NextResponse.json({ error: "Email isn't configured on this deployment." }, { status: 409 });
    }
    let where = { property: "Your property", unit: "Unit 1" };
    try {
      const { properties } = await residentRoster();
      if (properties[0]?.name) where = { property: properties[0].name, unit: "Unit 1" };
    } catch { /* a sample is still worth sending without it */ }
    const { subject, html } = inviteEmail({
      name: gate.me.entity?.name || "there",
      email: gate.me.email,
      ...where,
    });
    const res = await sendEmail({ to: gate.me.email, subject, html });
    // The provider's id, because "we sent it" and "it arrived" are different
    // claims and the send-only API key cannot check the second one. With the id
    // the send can be looked up in the provider's own dashboard.
    return res.ok
      ? NextResponse.json({ preview: true, sentTo: gate.me.email, messageId: res.id })
      : NextResponse.json({ error: res.error }, { status: 502 });
  }

  const propertyId = body.propertyId == null || body.propertyId === "" ? null : Number(body.propertyId);
  if (propertyId != null && !Number.isFinite(propertyId)) {
    return NextResponse.json({ error: "That property id isn't valid." }, { status: 400 });
  }
  const asked = Number(body.limit);
  const limit = Math.min(Number.isFinite(asked) && asked > 0 ? Math.trunc(asked) : DAILY_CAP, DAILY_CAP);

  try {
    const { residents, state } = await audience();

    // Never anyone twice. "failed" is retried, "invited" and "joined" are not.
    const queue = residents
      .filter((r) => (propertyId == null ? true : r.propertyId === propertyId))
      .filter((r) => ["new", "failed"].includes(state(r)))
      .slice(0, limit);

    if (!queue.length) {
      return NextResponse.json({ sent: 0, failed: 0, remaining: 0, note: "Everyone in that group has already been invited." });
    }

    const { sent, failed, results, error } = await sendInvites({ residents: queue, by: gate.me.email });
    if (error) return NextResponse.json({ error }, { status: 409 });

    // Recount so the screen shows the truth rather than arithmetic on a stale
    // number: the roster is cached and a send may have partly failed.
    const after = await audience();
    const remaining = after.residents
      .filter((r) => (propertyId == null ? true : r.propertyId === propertyId))
      .filter((r) => ["new", "failed"].includes(after.state(r))).length;

    return NextResponse.json({
      sent,
      failed,
      remaining,
      tally: after.tally,
      failures: results.filter((r) => !r.ok).slice(0, 20),
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Couldn't send that batch." }, { status: 502 });
  }
}
