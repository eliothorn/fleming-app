// A durable record of everything this app changes in Buildium, and a switch that
// stops it changing anything more.
//
// Two problems this solves, both of which only appear once writes are live:
//
// 1. "What did the app touch?" Buildium's own task history shows a change but not
//    that it came from here, and console.log is useless — Vercel keeps runtime
//    logs for an hour on Hobby. A week later, when the office asks why a ticket
//    moved, there has to be an answer. Each row also stores the record as it was
//    BEFORE the write, which is what makes a bad update reversible rather than
//    merely explicable.
//
// 2. "Turn it off, now." BUILDIUM_WRITES lives in Vercel, and changing it there
//    needs a redeploy — a few minutes, assuming the build succeeds while you are
//    panicking. A row in the database takes effect within the cache TTL.
//
// Both fail soft. A logging failure must never prevent a write the user asked
// for, and a database blip must never silently disable the app.

import { getAdminSupabase } from "../auth/supabase.js";
import { isSupabaseConfigured } from "../env.js";

const TABLE = "buildium_writes";
const FLAG_TABLE = "app_flags";
const HALT_FLAG = "buildium_writes_halted";
const HALT_TTL_MS = 20 * 1000;

let tableMissing = false;
let flagTableMissing = false;

const isMissingTable = (e) =>
  e && (e.code === "42P01" || /relation .* does not exist|could not find the table/i.test(e.message || ""));

// ── Kill switch ───────────────────────────────────────────────────────────────
// Cached briefly so it costs nothing per request. On a lookup error the LAST
// KNOWN answer is kept rather than reset: if someone has just halted writes, a
// transient error must not un-halt them.
export async function writesHalted() {
  if (!isSupabaseConfigured() || flagTableMissing) return false;
  const c = (globalThis.__flWriteHalt ||= { at: 0, value: false, known: false });
  if (c.known && Date.now() - c.at < HALT_TTL_MS) return c.value;

  try {
    const { data, error } = await getAdminSupabase()
      .from(FLAG_TABLE).select("value").eq("key", HALT_FLAG).maybeSingle();
    if (error) {
      if (isMissingTable(error)) { flagTableMissing = true; return false; }
      return c.known ? c.value : false;
    }
    c.value = data?.value === true || data?.value === "true";
    c.known = true;
    c.at = Date.now();
    return c.value;
  } catch {
    return c.known ? c.value : false;
  }
}

// ── Audit log ─────────────────────────────────────────────────────────────────
// Returns an id to settle later, or null when logging isn't available. Never
// throws: a write the office asked for must not fail because the log did.
export async function beginWrite({ method, path, taskId, payload, before, actor }) {
  if (!isSupabaseConfigured() || tableMissing) return null;
  try {
    const { data, error } = await getAdminSupabase()
      .from(TABLE)
      .insert({
        method, path,
        task_id: taskId ?? null,
        request_payload: payload ?? null,
        before_snapshot: before ?? null,
        actor_email: actor?.email ?? null,
        actor_role: actor?.role ?? null,
        outcome: "attempted",
      })
      .select("id")
      .single();
    if (error) { if (isMissingTable(error)) tableMissing = true; return null; }
    return data?.id ?? null;
  } catch { return null; }
}

export async function finishWrite(id, { ok, status, body, error }) {
  if (id == null || !isSupabaseConfigured() || tableMissing) return;
  try {
    await getAdminSupabase().from(TABLE).update({
      outcome: ok ? "succeeded" : "failed",
      response_status: status ?? null,
      // Trimmed: a Buildium error body can be long, and this table is for
      // answering questions, not for archiving payloads.
      response_body: body ? JSON.parse(JSON.stringify(body)) : null,
      error: error ? String(error).slice(0, 2000) : null,
    }).eq("id", id);
  } catch { /* the write itself already happened; losing its epilogue is survivable */ }
}

// Who is making the change. Set per-request by the API routes, read by the client
// deep inside a write — threading it through every signature would touch a dozen
// call sites for one string. Cleared by the same routes so it cannot leak from
// one request into the next on a warm serverless instance.
export function setWriteActor(actor) {
  globalThis.__flWriteActor = actor || null;
}
export function currentWriteActor() {
  return globalThis.__flWriteActor || null;
}

export function writeLogAvailable() {
  return isSupabaseConfigured() && !tableMissing;
}
