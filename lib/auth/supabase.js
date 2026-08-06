// Real Supabase clients — used only when NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are set.
// Browser client handles auth (signUp/signIn/signOut). The admin client (service
// role, server-only) reads the user's role/profile from the `profiles` table.
//
// See supabase/schema.sql for the profiles table + trigger that assigns a role by
// matching the new user's email to a Buildium record.

import { createClient } from "@supabase/supabase-js";

// Singleton on purpose. Magic-link and OAuth returns carry the session in the
// URL, and `detectSessionInUrl` consumes it exactly once — a second client
// instance would race for it and one of them would come back empty-handed.
let browserClient = null;
export function getBrowserSupabase() {
  if (browserClient) return browserClient;
  browserClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // flowType was "pkce", which stores a verifier in THIS browser's storage and
    // then requires the emailed link to be opened in the same browser. On a
    // phone that essentially never happens: the request is made in Safari and
    // the mail is opened in Gmail, whose in-app browser is a different browser,
    // so the link dead-ended. "implicit" carries the session in the link itself
    // and therefore works wherever it is opened.
    //
    // The better path is /auth/confirm, which verifies a token hash on the
    // server and needs no browser state at all; this keeps the current emailed
    // links working until the Supabase email template is switched over to it.
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } }
  );
  return browserClient;
}

// Server-side anon client — used only to VERIFY a password (signInWithPassword).
export function getAnonSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
}

// SERVER-ONLY. Never import into a client component.
export function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}
