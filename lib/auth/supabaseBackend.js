// Supabase-backed auth (used when Supabase is configured). Passwords + users live
// in Supabase (secure); we verify credentials there, then issue the SAME kind of
// server session cookie the dev path uses. That keeps the app's server components
// and API routes working unchanged (cookie-based), with no browser token handling.
//
// Sessions are held in-memory (globalThis) → they reset on a full server restart,
// which just means "log in again." Fine for this stage; persist to a table later.

import { getAdminSupabase, getAnonSupabase } from "./supabase";
import { matchByEmail } from "../buildium/matcher";

// If the email is a known Buildium person, upgrade the profile with their real
// role + unit/identity. Best-effort — never throws into the auth flow.
async function applyMatch(userId, email) {
  try {
    const m = await matchByEmail(email);
    if (!m) return false;
    await getAdminSupabase().from("profiles").update({ role: m.role, entity: m.entity, matched: true }).eq("id", userId);
    return true;
  } catch { return false; }
}

function sessions() {
  return (globalThis.__flSupaSessions ||= new Map());
}
function issue(userId) {
  const token = `sess_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  sessions().set(token, userId);
  return token;
}

async function publicUser(userId, emailFallback) {
  const admin = getAdminSupabase();
  const { data: prof } = await admin
    .from("profiles")
    .select("email, role, entity, matched")
    .eq("id", userId)
    .single();
  if (!prof) {
    return { id: userId, email: emailFallback || "", name: emailFallback || "", role: "resident", entity: { name: emailFallback || "", unit: "Pending assignment", address: "—" }, matched: false };
  }
  return { id: userId, email: prof.email, name: prof.entity?.name || prof.email, role: prof.role, entity: prof.entity, matched: prof.matched };
}

export async function supaSignup({ email, password, name }) {
  email = String(email || "").trim().toLowerCase();
  if (!email || !password) return { error: "Email and password are required." };
  const admin = getAdminSupabase();
  // email_confirm:true → no confirmation email needed; user can log in immediately.
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name: name || "" },
  });
  if (error) {
    if (/already/i.test(error.message)) return { error: "An account with that email already exists. Try logging in." };
    return { error: error.message };
  }
  await applyMatch(data.user.id, email); // link to their real Buildium record if known
  return { token: issue(data.user.id), user: await publicUser(data.user.id, email) };
}

export async function supaLogin({ email, password }) {
  email = String(email || "").trim().toLowerCase();
  const anon = getAnonSupabase();
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data?.user) return { error: "Invalid email or password." };
  // Still-unmatched users get another chance to link (e.g. added to Buildium later).
  const current = await publicUser(data.user.id, email);
  if (!current.matched) await applyMatch(data.user.id, email);
  return { token: issue(data.user.id), user: await publicUser(data.user.id, email) };
}

export async function supaSessionUser(token) {
  const userId = token && sessions().get(token);
  if (!userId) return null;
  try { return await publicUser(userId); } catch { return null; }
}

export function supaLogout(token) {
  sessions().delete(token);
}
