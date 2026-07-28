"use client";
// Client-side auth API. All flows go through our server endpoints, which use
// Supabase when configured and the dev store otherwise — so the browser never
// handles tokens or Supabase directly.

export const liveMode = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || "Something went wrong." };
  return data;
}

export const signUp = (payload) => post("/api/auth/signup", payload);
export const signIn = (payload) => post("/api/auth/login", payload);

export async function signOut() {
  // Clear the Supabase browser session too, or the next visit silently
  // re-authenticates from localStorage after the server cookie is gone.
  if (liveMode) {
    try {
      const { getBrowserSupabase } = await import("./supabase");
      await getBrowserSupabase().auth.signOut();
    } catch {}
  }
  return post("/api/auth/logout", {});
}

const callbackUrl = () => `${window.location.origin}/auth/callback`;

// Passwordless: Supabase emails a one-tap link. Works for every provider, and
// receiving the mail proves the address — which is also what links the person to
// their Buildium record.
export async function sendMagicLink(email) {
  if (!liveMode) return { error: "Email sign-in needs Supabase configured." };
  const { getBrowserSupabase } = await import("./supabase");
  const { error } = await getBrowserSupabase().auth.signInWithOtp({
    email: String(email || "").trim(),
    options: { emailRedirectTo: callbackUrl() },
  });
  return error ? { error: error.message } : { sent: true };
}

// Which social providers Supabase actually has switched on. signInWithOAuth
// navigates the browser to Supabase immediately, so if a provider is disabled
// the user lands on a raw JSON error page and our code never gets to run —
// hence checking first rather than handling the failure afterwards.
let providerCache = null;
export async function getEnabledProviders() {
  if (!liveMode) return {};
  if (providerCache) return providerCache;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    });
    const json = await res.json();
    providerCache = json?.external || {};
  } catch {
    providerCache = {};
  }
  return providerCache;
}

export async function signInWithGoogle() {
  if (!liveMode) return { error: "Google sign-in needs Supabase configured." };

  const providers = await getEnabledProviders();
  if (!providers.google) {
    return { error: "Google sign-in isn't switched on yet. Use the email link below — it works right now." };
  }

  const { getBrowserSupabase } = await import("./supabase");
  const { error } = await getBrowserSupabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl() },
  });
  return error ? { error: error.message } : { redirecting: true };
}

// Runs on /auth/callback: turn whatever Supabase handed the browser into our
// own server session cookie.
export async function completeBrowserSignIn() {
  const { getBrowserSupabase } = await import("./supabase");
  const supa = getBrowserSupabase();

  // PKCE flow returns ?code=; implicit flow puts tokens in the hash, which the
  // client picks up automatically via detectSessionInUrl. Support both.
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const errDesc = url.searchParams.get("error_description");
  if (errDesc) return { error: errDesc };

  if (code) {
    const { error } = await supa.auth.exchangeCodeForSession(code);
    if (error) return { error: error.message };
  }

  let { data } = await supa.auth.getSession();
  // detectSessionInUrl resolves asynchronously right after load; give it a beat.
  if (!data?.session) {
    await new Promise((r) => setTimeout(r, 350));
    ({ data } = await supa.auth.getSession());
  }
  const accessToken = data?.session?.access_token;
  if (!accessToken) return { error: "We couldn't complete that sign-in. Please request a new link." };

  return post("/api/auth/exchange", { accessToken });
}

export async function getSession() {
  const res = await fetch("/api/auth/session", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  return data.user || null;
}

// Demo-only role switch (server returns 403 when Supabase is live).
export const viewAs = (role) => post("/api/auth/view-as", { role });
