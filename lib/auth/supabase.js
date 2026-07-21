// Real Supabase clients — used only when NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are set.
// Browser client handles auth (signUp/signIn/signOut). The admin client (service
// role, server-only) reads the user's role/profile from the `profiles` table.
//
// See supabase/schema.sql for the profiles table + trigger that assigns a role by
// matching the new user's email to a Buildium record.

import { createClient } from "@supabase/supabase-js";

export function getBrowserSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: true, autoRefreshToken: true } }
  );
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
