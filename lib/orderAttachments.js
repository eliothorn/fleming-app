// Photos and notes that belong to a work order but that Buildium does not
// store: the resident's picture of the problem, the contractor's picture of
// the finished job and their note. See supabase/order-attachments.sql.
//
// Unlike the inspection store this does NOT fall back to memory when the
// database is unavailable. A photo "saved" into a serverless instance's RAM
// is a photo lost, and the caller is better placed to say so. In demo mode
// (no Supabase) attachments live in a per-process Map, which is what the
// rest of demo mode does too and is fine for a single dev server.
import { isSupabaseConfigured } from "./env";
import { getAdminSupabase } from "./auth/supabase";

const TABLE = "order_attachments";
const mem = () => (globalThis.__flOrderAttachments ||= []);

// Buildium task id from either a bare number or the app's "WO-123" form.
export function taskIdOf(orderId) {
  const n = Number(String(orderId ?? "").replace(/^WO-/, ""));
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

// Record one attachment. Throws on a database error so the route can report
// that the ticket exists but the photo did not stick.
export async function addAttachment({ taskId, kind, path = null, note = null, me }) {
  const row = {
    task_id: taskId, kind, path: path || null, note: note ? String(note).slice(0, 4000) : null,
    by_user: me?.id || null, by_role: me?.role || null,
  };
  if (!isSupabaseConfigured()) {
    mem().push({ ...row, created_at: new Date().toISOString() });
    return;
  }
  const { error } = await getAdminSupabase().from(TABLE).insert(row);
  if (error) throw new Error(`Could not save the photo against the ticket: ${error.message}`);
}

// Everything attached to a set of orders, ready to merge: a Map from task id
// to { photos:[paths], completion:{ paths:[], note, at } | null }.
export async function attachmentsFor(taskIds) {
  const ids = [...new Set(taskIds.map(taskIdOf).filter((n) => n != null))];
  const out = new Map();
  if (!ids.length) return out;

  let rows;
  if (!isSupabaseConfigured()) {
    rows = mem().filter((r) => ids.includes(r.task_id));
  } else {
    const { data, error } = await getAdminSupabase()
      .from(TABLE).select("task_id, kind, path, note, created_at")
      .in("task_id", ids).order("created_at", { ascending: true });
    if (error) throw new Error(`Could not load order photos: ${error.message}`);
    rows = data || [];
  }
  for (const r of rows) {
    const e = out.get(r.task_id) || { photos: [], completion: null };
    if (r.kind === "request" && r.path) e.photos.push(r.path);
    // One submission writes one row per photo, so completion rows accumulate
    // rather than replace. The note takes the latest non-empty one; rows arrive
    // oldest-first. A contractor who somehow submits twice gets both sets of
    // photos shown, which is the right way round for evidence.
    if (r.kind === "completion") {
      const c = e.completion || { paths: [], note: null, at: null };
      if (r.path) c.paths.push(r.path);
      if (r.note) c.note = r.note;
      c.at = r.created_at;
      e.completion = c;
    }
    out.set(r.task_id, e);
  }
  return out;
}

// Put the stored attachments back onto the order shapes the UI already reads:
// `photos` for the resident's pictures, and `completionPhotos` / `photoAdded` /
// `completionNote` / `vendorCompleted` for the contractor's.
//
// `photoAdded` stays alongside `completionPhotos` and holds the first photo.
// Every completion recorded before photos could be plural has exactly one, so
// the single-photo field remains correct for them and nothing has to migrate.
export function mergeAttachments(orders, byTask) {
  return orders.map((o) => {
    const a = byTask.get(taskIdOf(o.id));
    if (!a) return o;
    const merged = { ...o, photos: a.photos };
    if (a.completion) {
      merged.vendorCompleted = true;
      merged.completionPhotos = a.completion.paths;
      merged.photoAdded = a.completion.paths[0] || o.photoAdded || null;
      merged.completionNote = a.completion.note || o.completionNote || "";
      // Buildium reads a completed-by-vendor job back as "scheduled"
      // (InProgress). The stored completion is what says it is awaiting the
      // office's sign-off, unless the office has since closed it.
      if (merged.status !== "done") merged.status = "review";
    }
    return merged;
  });
}
