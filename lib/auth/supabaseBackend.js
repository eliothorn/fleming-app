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

// Magic-link and Google sign-in complete in the BROWSER, so the app ends up
// holding a Supabase access token rather than a password we verified ourselves.
// This exchanges that token for the same server-side session cookie every other
// path uses, so the rest of the app stays backend-agnostic.
//
// The token is verified against Supabase before it is trusted — a caller cannot
// mint a session by inventing one.
export async function supaSessionFromAccessToken(accessToken) {
  if (!accessToken) return { error: "Missing sign-in token." };
  const admin = getAdminSupabase();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data?.user) return { error: "That sign-in link is invalid or has expired." };

  const user = data.user;
  // The DB trigger creates a profile row on signup, but a first-time OAuth user
  // can arrive before that lands — insert defensively so login never dead-ends.
  const { data: existing } = await admin.from("profiles").select("id, matched").eq("id", user.id).maybeSingle();
  if (!existing) {
    await admin.from("profiles").insert({
      id: user.id,
      email: user.email,
      role: "resident",
      entity: {
        name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Resident",
        unit: "Pending assignment",
        address: "-",
      },
      matched: false,
    });
  }
  // Link them to their real Buildium tenant/owner/vendor record if we can.
  if (!existing?.matched) await applyMatch(user.id, user.email);

  return { token: issue(user.id), user: await publicUser(user.id, user.email) };
}

export async function supaSessionUser(token) {
  const userId = token && sessions().get(token);
  if (!userId) return null;
  try { return await publicUser(userId); } catch { return null; }
}

export function supaLogout(token) {
  sessions().delete(token);
}
