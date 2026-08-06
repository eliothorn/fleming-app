// Sign-in links must be redeemable exactly once.
//
// Measured against this project: presenting the same token hash to verifyOtp
// three times produced three valid sessions. Left alone, an emailed link is a
// working key until it expires — which makes a forwarded email, a shared phone
// or a compromised mailbox into account access.
//
// consume() records a link the first time it is spent and refuses it after.
// Mirrors the fallback pattern used by inspections and templates so the app
// keeps working before supabase/signin-links.sql has been run — with the
// important difference that the fallback is per-process, so it catches reuse on
// the same instance but cannot on a cold one. That is a weaker guarantee than
// the table gives, and it is why the migration matters.

import { isSupabaseConfigured } from "../env";
import { getAdminSupabase } from "./supabase";

let tableMissing = false;
export const signinLinkStorageMode = () =>
  !isSupabaseConfigured() || tableMissing ? "memory-fallback" : "database";

function isMissingTable(error) {
  return error && (error.code === "PGRST205" || /schema cache|does not exist/i.test(error.message || ""));
}

// Supabase's own link lifetime; the record only needs to outlive that.
const LINK_TTL_MS = 60 * 60 * 1000;
const memUsed = () => (globalThis.__flUsedLinks ||= new Map());

function memConsume(tokenHash) {
  const seen = memUsed();
  const now = Date.now();
  for (const [k, at] of seen) if (now - at > LINK_TTL_MS) seen.delete(k);
  if (seen.has(tokenHash)) return false;
  seen.set(tokenHash, now);
  return true;
}

// true  → this link had not been used; it is now spent.
// false → already redeemed, refuse it.
export async function consumeSigninLink(tokenHash) {
  if (!tokenHash) return false;
  if (!isSupabaseConfigured() || tableMissing) return memConsume(tokenHash);

  try {
    const admin = getAdminSupabase();
    // The primary key does the work: a second insert of the same hash conflicts,
    // which is race-safe in a way "select then insert" would not be.
    const { error } = await admin.from("used_signin_links").insert({
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + LINK_TTL_MS).toISOString(),
    });

    if (error) {
      if (isMissingTable(error)) {
        tableMissing = true;
        console.warn("[auth] used_signin_links table missing — sign-in links are not reliably single-use. Run supabase/signin-links.sql.");
        return memConsume(tokenHash);
      }
      // 23505 is a unique violation: the link has already been spent.
      if (error.code === "23505") return false;
      throw error;
    }

    admin.rpc("purge_used_signin_links").then(() => {}, () => {});
    return true;
  } catch {
    // Never lock someone out because the bookkeeping failed; fall back to the
    // per-process guard rather than refusing a legitimate sign-in.
    return memConsume(tokenHash);
  }
}
