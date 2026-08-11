// Inspection records — durable in Supabase, with a memory fallback so the app
// keeps working before supabase/inspections.sql has been run.
//
// Photo paths point at objects in the private fleming-photos bucket; the rows
// only ever store the path, never a URL, so access always goes back through the
// signed-URL route.

import { isSupabaseConfigured } from "./env.js";
import { getAdminSupabase } from "./auth/supabase.js";
import { mockStore } from "./buildium/store.js";

let tableMissing = false;
export const inspectionStorageMode = () =>
  !isSupabaseConfigured() || tableMissing ? "memory-fallback" : "database";

function isMissingTable(error) {
  return error && (error.code === "PGRST205" || /schema cache|does not exist/i.test(error.message || ""));
}

// Shape returned to the UI, matching what the screens already expect.
function toRecord(row, items = []) {
  return {
    id: row.id,
    property: row.property,
    scope: row.scope,
    by: row.performed_by_name || "Employee",
    date: row.performed_on,
    nextDate: row.next_date,
    passed: row.passed,
    failed: row.failed,
    createdAt: row.created_at,
    items: items.map((i) => ({
      id: i.id,
      label: i.label,
      category: i.category,
      critical: i.critical,
      result: i.result,
      note: i.note,
      photoPath: i.photo_path,
    })),
  };
}

export async function listInspections({ limit = 50 } = {}) {
  if (!isSupabaseConfigured()) return mockStore.listInspections();
  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin
      .from("inspections")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      if (isMissingTable(error)) { tableMissing = true; return mockStore.listInspections(); }
      throw error;
    }
    return (data || []).map((r) => toRecord(r));
  } catch {
    return mockStore.listInspections();
  }
}

export async function getInspection(id) {
  if (!isSupabaseConfigured() || tableMissing) return null;
  const admin = getAdminSupabase();
  const { data: row, error } = await admin.from("inspections").select("*").eq("id", id).maybeSingle();
  if (error || !row) return null;
  const { data: items } = await admin
    .from("inspection_items")
    .select("*")
    .eq("inspection_id", id)
    .order("position", { ascending: true });
  return toRecord(row, items || []);
}

// input: { property, scope, nextDate, passed, failed, items:[{label,category,critical,result,note,photoPath}] }
export async function createInspection(input, me) {
  const fallback = () =>
    mockStore.addInspection({
      property: input.property,
      scope: input.scope,
      date: "Today",
      nextDate: input.nextDate,
      passed: input.passed,
      failed: input.failed,
      by: me?.entity?.name || "Employee",
    });

  if (!isSupabaseConfigured()) return fallback();

  try {
    const admin = getAdminSupabase();
    const { data: row, error } = await admin
      .from("inspections")
      .insert({
        property: input.property,
        scope: input.scope,
        performed_by: me?.id ?? null,
        performed_by_name: me?.entity?.name || me?.email || "Employee",
        next_date: input.nextDate || null,
        passed: Number(input.passed) || 0,
        failed: Number(input.failed) || 0,
      })
      .select()
      .single();

    if (error) {
      if (isMissingTable(error)) { tableMissing = true; return fallback(); }
      throw error;
    }

    const items = (input.items || []).map((it, i) => ({
      inspection_id: row.id,
      label: String(it.label || "").slice(0, 300),
      category: it.category || null,
      critical: Boolean(it.critical),
      result: it.result === "fail" ? "fail" : it.result === "pass" ? "pass" : null,
      note: it.note || null,
      photo_path: it.photoPath || null,
      position: i,
    }));
    if (items.length) await admin.from("inspection_items").insert(items);

    return toRecord(row, items.map((i) => ({ ...i, id: undefined })));
  } catch {
    return fallback();
  }
}
