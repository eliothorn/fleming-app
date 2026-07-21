// Server-side "who is calling" resolver, used by API routes and the app shell.
// Both dev and Supabase modes use the same httpOnly session cookie — only the
// backend that resolves it differs.

import { cookies } from "next/headers";
import { isSupabaseConfigured } from "../env";
import { devSessionUser } from "./devStore";
import { supaSessionUser } from "./supabaseBackend";

export const SESSION_COOKIE = "fl_session";

// Works in server components (no arg) and route handlers (pass the Request; unused
// now but kept for signature stability).
export async function getServerUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return isSupabaseConfigured() ? supaSessionUser(token) : devSessionUser(token);
}
