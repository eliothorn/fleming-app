// Supabase-backed auth (used when Supabase is configured). Passwords + users live
// in Supabase (secure); we verify credentials there, then issue the SAME kind of
// server session cookie the dev path uses. That keeps the app's server components
// and API routes working unchanged (cookie-based), with no browser token handling.
//
// Sessions live in the `app_sessions` table (see supabase/sessions.sql). They
// were previously an in-process Map, which silently breaks on serverless hosting:
// every request can hit a different cold instance that has never seen the
// session, logging people out at random.

import { randomBytes } from "crypto";
import { getAdminSupabase, getAnonSupabase } from "./supabase.js";
import { matchByEmail } from "../buildium/matcher.js";

const SESSION_DAYS = 7;

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

// A profile that matched before its role learned to carry the id it needs.
//
// The stored entity is a snapshot taken at signup, so widening what a role
// records does nothing for anyone already matched — they stay on the old shape
// forever, and the feature that needed the new field silently has nothing to
// work with. Owners were matched with a name and no owner id, so their balance
// could not be looked up at all. Re-matching on the next sign-in fixes them
// without a migration, and costs one cached directory lookup.
function entityNeedsRefresh(role, entity) {
  if (role === "owner") return entity?.ownerId == null;
  if (role === "vendor") return entity?.vendorId == null;
  return false;
}

// Until supabase/sessions.sql has been run the table doesn't exist. Rather than
// breaking every login, fall back to the old in-memory map — correct on a single
// long-lived server, NOT safe on serverless. sessionStorageMode() reports which
// is in force so deployment checks can refuse to ship on the fallback.
const memSessions = () => (globalThis.__flSupaSessions ||= new Map());
let tableMissing = false;
export const sessionStorageMode = () => (tableMissing ? "memory-fallback" : "database");

function isMissingTable(error) {
  return error && (error.code === "PGRST205" || /schema cache|does not exist/i.test(error.message || ""));
}

// Cryptographically random — a session token is a bearer credential, so
// Math.random() (predictable, and seeded per process) was not adequate.
async function issue(userId) {
  const token = `sess_${randomBytes(32).toString("base64url")}`;
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  const admin = getAdminSupabase();
  const { error } = await admin.from("app_sessions").insert({ token, user_id: userId, expires_at: expires });

  if (error) {
    if (!isMissingTable(error)) throw new Error(`Could not start a session: ${error.message}`);
    if (!tableMissing) {
      tableMissing = true;
      console.warn("[auth] app_sessions table missing — using in-memory sessions. Run supabase/sessions.sql before deploying.");
    }
    memSessions().set(token, { userId, expiresAt: Date.parse(expires) });
    return token;
  }
  // Opportunistic cleanup; failure here must never block a login.
  admin.rpc("purge_expired_sessions").then(() => {}, () => {});
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
  // Login refuses the demo domain, but signup did not, and the database
  // trigger (supabase/schema.sql, match_identity) still hands the seeded demo
  // addresses their roles. Signing up as an unclaimed one such as
  // denise@fleming.test therefore returned a live EMPLOYEE session without
  // ever passing the lockout. Refuse it here as well.
  if (email.endsWith(DEMO_DOMAIN) && !demoAccountsAllowed()) {
    return { error: "Demo accounts are disabled. Sign up with your own email address." };
  }

  // Signing up with a password does not prove you own the mailbox.
  //
  // createUser({email_confirm:true}) marks the address confirmed without sending
  // anything to it, and applyMatch then reads the address off the Buildium
  // directory and hands over that person's role — employee, owner or vendor.
  // Staff addresses appear on listings and in this app's own email footers, so
  // anyone who had seen one could sign up as them. That was already an
  // unauthenticated route to a real resident's balance and address; with writes
  // switched on it becomes an unauthenticated route to changing the broker's
  // records.
  //
  // So an email belonging to a real person in Buildium can only be claimed with
  // the sign-in link, which requires actually receiving it. That path already
  // exists and is the one the login screen offers first.
  // Fail closed. If the directory cannot be consulted (Buildium down, rate
  // limited, key rotated) we cannot tell a stranger from a staff address, so
  // the account is not created rather than created unmatched and quietly
  // upgraded later.
  let known = null;
  try { known = await matchByEmail(email, { strict: true }); }
  catch { return { error: "We couldn't check that address just now. Please try again in a few minutes." }; }
  if (known) {
    return {
      error: "That email is already on file with Stephen Fleming Realty. Go back and choose “Use a sign-in link instead” — we'll email you a link that signs you straight in, no password needed.",
      useSigninLink: true,
    };
  }

  const admin = getAdminSupabase();
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name: name || "" },
  });
  if (error) {
    if (/already/i.test(error.message)) return { error: "An account with that email already exists. Try logging in." };
    return { error: error.message };
  }
  // Nothing to match — this address is not in Buildium — so the account stays a
  // pending-assignment resident until the office links it.
  return { token: await issue(data.user.id), user: await publicUser(data.user.id, email) };
}

// The seeded demo accounts (@fleming.test) share one well-known password and
// carry employee/owner roles, which on a public URL would expose real tenant
// data to anyone who has seen the README or the old login screen. They stay in
// the database — nothing is deleted — but cannot sign in unless explicitly
// re-enabled for a local demo via ALLOW_DEMO_ACCOUNTS=true.
const DEMO_DOMAIN = "@fleming.test";
export function demoAccountsAllowed() {
  return process.env.ALLOW_DEMO_ACCOUNTS === "true";
}

export async function supaLogin({ email, password }) {
  email = String(email || "").trim().toLowerCase();
  if (email.endsWith(DEMO_DOMAIN) && !demoAccountsAllowed()) {
    return { error: "Demo accounts are disabled. Sign in with your own email address." };
  }
  const anon = getAnonSupabase();
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data?.user) return { error: "Invalid email or password." };
  // A password never proved the mailbox, so this path must not be the one
  // that first hands an account a real person's role. An account created by
  // password while Buildium was unreachable (the known-email guard in
  // supaSignup could not run) would otherwise be upgraded to that person's
  // employee or owner view the next time its holder typed the password. Only
  // the sign-in link, which requires receiving the email, links an account
  // (see supaSessionFromAccessToken). An already-matched owner or vendor whose
  // stored identity predates the id it needs is still refreshed here; that
  // cannot escalate, it only fills in a field for a role already granted.
  const current = await publicUser(data.user.id, email);
  if (current.matched && entityNeedsRefresh(current.role, current.entity)) {
    await applyMatch(data.user.id, email);
  }
  return { token: await issue(data.user.id), user: await publicUser(data.user.id, email) };
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
  // Same lockout as the password path, so a demo account can't slip in via a
  // magic link or OAuth token either.
  if (String(user.email || "").toLowerCase().endsWith(DEMO_DOMAIN) && !demoAccountsAllowed()) {
    return { error: "Demo accounts are disabled. Sign in with your own email address." };
  }
  // The DB trigger creates a profile row on signup, but a first-time OAuth user
  // can arrive before that lands — insert defensively so login never dead-ends.
  // role and entity are needed below: without them entityNeedsRefresh() always
  // saw undefined and the owner/vendor identity refresh never ran on this path.
  const { data: existing } = await admin.from("profiles").select("id, matched, role, entity").eq("id", user.id).maybeSingle();
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
  if (!existing?.matched || entityNeedsRefresh(existing.role, existing.entity)) {
    await applyMatch(user.id, user.email);
  } else if (existing.role === "employee") {
    await revalidateEmployee(user.id, user.email);
  }

  return { token: await issue(user.id), user: await publicUser(user.id, user.email) };
}

// An employee's access has to follow Buildium. The match that granted the role
// ran once, at first sign-in, and nothing looked again, so someone the office
// deactivated in Buildium kept the full portfolio view and write access for as
// long as they cared to keep signing in. On every link sign-in, an employee is
// checked against the current directory: no longer an active staff record means
// demotion to a pending resident and every existing session ended. If the
// directory cannot be built (Buildium down) the role is left alone rather than
// locking the whole office out during an outage.
async function revalidateEmployee(userId, email) {
  let m;
  try { m = await matchByEmail(email, { strict: true }); }
  catch { return; }
  if (m && m.role === "employee") return;
  const admin = getAdminSupabase();
  const demoted = m
    ? { role: m.role, entity: m.entity, matched: true }
    : { role: "resident", entity: { name: email.split("@")[0], unit: "Pending assignment", address: "-" }, matched: false };
  await admin.from("profiles").update(demoted).eq("id", userId);
  await admin.from("app_sessions").delete().eq("user_id", userId);
}

export async function supaSessionUser(token) {
  if (!token) return null;
  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin
      .from("app_sessions")
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (error && isMissingTable(error)) {
      tableMissing = true;
      const hit = memSessions().get(token);
      if (!hit || hit.expiresAt < Date.now()) return null;
      return await publicUser(hit.userId);
    }
    if (error || !data) return null;
    // Expired rows may linger until the next purge — reject them on read.
    if (new Date(data.expires_at).getTime() < Date.now()) return null;
    return await publicUser(data.user_id);
  } catch {
    return null;
  }
}

export async function supaLogout(token) {
  if (!token) return;
  memSessions().delete(token);
  try { await getAdminSupabase().from("app_sessions").delete().eq("token", token); } catch {}
}
