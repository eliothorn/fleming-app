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
export const signOut = () => post("/api/auth/logout", {});

export async function getSession() {
  const res = await fetch("/api/auth/session", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  return data.user || null;
}

// Demo-only role switch (server returns 403 when Supabase is live).
export const viewAs = (role) => post("/api/auth/view-as", { role });
