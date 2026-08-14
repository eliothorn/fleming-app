// Push notifications.
//
// Server side of the web-push flow: hold each device's subscription, and send to
// every device a person has registered.
//
// Two rules this follows, both learned the hard way elsewhere in this app:
//
//   1. Nothing here throws into the caller. A notification is a courtesy on top
//      of an action that already happened — if assigning a contractor succeeded
//      but the push failed, the assignment still stands and the UI must not
//      report otherwise.
//   2. It reports honestly how many devices it actually reached, so a screen can
//      say "we told them" only when that is true.
//
// Dead subscriptions are pruned on the spot: browsers return 404 or 410 forever
// once a subscription is gone, and without pruning the same dead endpoint is
// retried on every send until the table is mostly corpses.

import webpush from "web-push";
import { getAdminSupabase } from "./auth/supabase.js";
import { isSupabaseConfigured } from "./env.js";

const TABLE = "push_subscriptions";
let tableMissing = false;
let configured = false;

export function pushConfigured() {
  return Boolean(
    isSupabaseConfigured() &&
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY
  );
}

function ensureConfigured() {
  if (configured || !pushConfigured()) return pushConfigured();
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:inspections@dangelore.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
  return true;
}

const isMissingTable = (e) =>
  e && (e.code === "42P01" || /relation .* does not exist|could not find the table/i.test(e.message || ""));

// ── Subscriptions ─────────────────────────────────────────────────────────────
export async function saveSubscription(userId, sub, userAgent) {
  if (!pushConfigured() || tableMissing) return { ok: false, error: "Notifications aren't configured." };
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return { ok: false, error: "That subscription is incomplete." };
  }
  try {
    // Keyed on endpoint, so re-subscribing the same device replaces its row
    // instead of adding a second one that would deliver a duplicate.
    const { error } = await getAdminSupabase().from(TABLE).upsert({
      endpoint: sub.endpoint,
      user_id: userId,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: (userAgent || "").slice(0, 300) || null,
      failed_at: null,
    }, { onConflict: "endpoint" });
    if (error) {
      if (isMissingTable(error)) { tableMissing = true; return { ok: false, error: "Run supabase/push.sql first." }; }
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

export async function removeSubscription(userId, endpoint) {
  if (!pushConfigured() || tableMissing) return { ok: true };
  try {
    const q = getAdminSupabase().from(TABLE).delete().eq("user_id", userId);
    // No endpoint means "this person, everywhere" — used when they turn
    // notifications off rather than when one device unsubscribes.
    await (endpoint ? q.eq("endpoint", endpoint) : q);
    return { ok: true };
  } catch { return { ok: true }; }
}

export async function countSubscriptions(userId) {
  if (!pushConfigured() || tableMissing) return 0;
  try {
    const { count, error } = await getAdminSupabase()
      .from(TABLE).select("endpoint", { count: "exact", head: true })
      .eq("user_id", userId).is("failed_at", null);
    if (error) { if (isMissingTable(error)) tableMissing = true; return 0; }
    return count || 0;
  } catch { return 0; }
}

// ── Sending ───────────────────────────────────────────────────────────────────
// Returns { sent, failed, devices } — never throws.
export async function sendPush(userId, { title, body, url = "/app", tag }) {
  if (!ensureConfigured() || tableMissing || !userId) return { sent: 0, failed: 0, devices: 0 };

  let rows = [];
  try {
    const { data, error } = await getAdminSupabase()
      .from(TABLE).select("endpoint, p256dh, auth").eq("user_id", userId).is("failed_at", null);
    if (error) { if (isMissingTable(error)) tableMissing = true; return { sent: 0, failed: 0, devices: 0 }; }
    rows = data || [];
  } catch { return { sent: 0, failed: 0, devices: 0 }; }

  if (!rows.length) return { sent: 0, failed: 0, devices: 0 };

  const payload = JSON.stringify({ title, body, url, tag: tag || "fleming" });
  const dead = [];
  let sent = 0, failed = 0;

  await Promise.all(rows.map(async (r) => {
    try {
      await webpush.sendNotification(
        { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
        payload,
        { TTL: 60 * 60 * 24 } // a day: a maintenance update is stale after that
      );
      sent++;
    } catch (e) {
      failed++;
      // 404/410 mean the subscription is permanently gone, not that the network
      // hiccuped. Anything else might succeed next time, so only these are pruned.
      if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(r.endpoint);
    }
  }));

  if (dead.length) {
    try { await getAdminSupabase().from(TABLE).delete().in("endpoint", dead); } catch { /* next send retries */ }
  }
  return { sent, failed, devices: rows.length };
}

// Look up an app account from a Buildium tenant id, so a resident can be pushed
// about their own job. Returns null when they have never signed in — which is
// most of them, and is why email stays the primary channel.
export async function userIdForTenant(tenantId) {
  if (!isSupabaseConfigured() || tenantId == null) return null;
  try {
    const { data } = await getAdminSupabase()
      .from("profiles").select("id, entity").eq("role", "resident").limit(2000);
    const hit = (data || []).find((p) => Number(p.entity?.tenantId) === Number(tenantId));
    return hit?.id ?? null;
  } catch { return null; }
}
