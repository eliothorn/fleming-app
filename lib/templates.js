// Inspection templates — the checklists staff inspect against.
//
// These were held in server memory, so a checklist someone built for the
// broker's properties disappeared on the next restart. They are the company's
// own working documents, not Buildium data, so they live in this database
// alongside the inspection reports that use them.
//
// Mirrors lib/inspections.js: durable in Supabase, with a memory fallback so
// the app keeps working before supabase/templates.sql has been run.

import { isSupabaseConfigured } from "./env.js";
import { getAdminSupabase } from "./auth/supabase.js";
import { mockStore } from "./buildium/store.js";

let tableMissing = false;
export const templateStorageMode = () =>
  !isSupabaseConfigured() || tableMissing ? "memory-fallback" : "database";

function isMissingTable(error) {
  return error && (error.code === "PGRST205" || /schema cache|does not exist/i.test(error.message || ""));
}

// Shape the screens already expect: { id, name, desc, items:[{id,category,label,critical}] }
function toTemplate(row, items = []) {
  return {
    id: row.id,
    name: row.name,
    desc: row.description || "",
    items: items.map((i) => ({
      id: i.id,
      category: i.category || "General",
      label: i.label,
      critical: Boolean(i.critical),
    })),
  };
}

// The editor sends whole items; store them positionally so order is preserved.
function toRows(templateId, items) {
  return (items || [])
    .filter((i) => String(i?.label || "").trim())
    .map((i, position) => ({
      template_id: templateId,
      label: String(i.label).trim().slice(0, 300),
      category: i.category || null,
      critical: Boolean(i.critical),
      position,
    }));
}

export async function listTemplates() {
  if (!isSupabaseConfigured() || tableMissing) return mockStore.listTemplates();
  try {
    const admin = getAdminSupabase();
    const { data: rows, error } = await admin
      .from("inspection_templates")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      if (isMissingTable(error)) { tableMissing = true; return mockStore.listTemplates(); }
      throw error;
    }
    if (!rows?.length) return [];

    // One query for every template's items, then grouped — a per-template query
    // would be a request per checklist on every app load.
    const { data: items } = await admin
      .from("inspection_template_items")
      .select("*")
      .in("template_id", rows.map((r) => r.id))
      .order("position", { ascending: true });

    const byTemplate = new Map();
    for (const it of items || []) {
      const list = byTemplate.get(it.template_id) || [];
      list.push(it);
      byTemplate.set(it.template_id, list);
    }
    return rows.map((r) => toTemplate(r, byTemplate.get(r.id) || []));
  } catch {
    return mockStore.listTemplates();
  }
}

export async function createTemplate(input) {
  const fallback = () => mockStore.createTemplate(input);
  if (!isSupabaseConfigured() || tableMissing) return fallback();

  // The editor generates the id client-side; keep it so its React keys and any
  // optimistic row already on screen still line up.
  const id = String(input.id || `t-${Math.random().toString(36).slice(2, 8)}`);
  try {
    const admin = getAdminSupabase();
    const { data: row, error } = await admin
      .from("inspection_templates")
      .insert({ id, name: String(input.name || "Untitled checklist").slice(0, 200), description: input.desc || null })
      .select()
      .single();
    if (error) {
      if (isMissingTable(error)) { tableMissing = true; return fallback(); }
      throw error;
    }
    const rows = toRows(id, input.items);
    if (rows.length) await admin.from("inspection_template_items").insert(rows);
    return (await getTemplate(id)) || toTemplate(row, []);
  } catch {
    return fallback();
  }
}

export async function getTemplate(id) {
  if (!isSupabaseConfigured() || tableMissing) return null;
  const admin = getAdminSupabase();
  const { data: row } = await admin.from("inspection_templates").select("*").eq("id", id).maybeSingle();
  if (!row) return null;
  const { data: items } = await admin
    .from("inspection_template_items")
    .select("*")
    .eq("template_id", id)
    .order("position", { ascending: true });
  return toTemplate(row, items || []);
}

export async function updateTemplate(id, patch) {
  if (!isSupabaseConfigured() || tableMissing) return mockStore.updateTemplate(id, patch);
  try {
    const admin = getAdminSupabase();
    const fields = {};
    if (patch.name != null) fields.name = String(patch.name).slice(0, 200);
    if (patch.desc != null) fields.description = patch.desc;
    fields.updated_at = new Date().toISOString();

    const { data: row, error } = await admin
      .from("inspection_templates").update(fields).eq("id", id).select().maybeSingle();
    if (error) {
      if (isMissingTable(error)) { tableMissing = true; return mockStore.updateTemplate(id, patch); }
      throw error;
    }
    if (!row) return null;

    // Items arrive as the complete list. Replacing them wholesale keeps order
    // and deletions correct without diffing, and the editor never sends a
    // partial list.
    if (Array.isArray(patch.items)) {
      await admin.from("inspection_template_items").delete().eq("template_id", id);
      const rows = toRows(id, patch.items);
      if (rows.length) await admin.from("inspection_template_items").insert(rows);
    }
    return await getTemplate(id);
  } catch {
    return mockStore.updateTemplate(id, patch);
  }
}

export async function deleteTemplate(id) {
  if (!isSupabaseConfigured() || tableMissing) return mockStore.deleteTemplate(id);
  try {
    const admin = getAdminSupabase();
    // Items go with it via the foreign key's cascade.
    const { data, error } = await admin.from("inspection_templates").delete().eq("id", id).select("id");
    if (error) {
      if (isMissingTable(error)) { tableMissing = true; return mockStore.deleteTemplate(id); }
      throw error;
    }
    return Boolean(data?.length);
  } catch {
    return mockStore.deleteTemplate(id);
  }
}
