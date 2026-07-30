// Central feature-detection: the app runs in "dev/mock" mode until real
// credentials are provided via .env.local, then transparently switches to live.

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// Server-only checks (do not call from client components).
export function isBuildiumConfigured() {
  return Boolean(process.env.BUILDIUM_CLIENT_ID && process.env.BUILDIUM_CLIENT_SECRET);
}

// Keys present is enough to run the diagnostic, but the live UI only switches to
// real Buildium data once BUILDIUM_LIVE=true — set that only after the field
// mappings are confirmed against real responses, so users never see broken data.
export function isBuildiumLive() {
  return isBuildiumConfigured() && process.env.BUILDIUM_LIVE === "true";
}

// Writes are a separate, deliberate switch on top of live reads: creating or
// changing a ticket in the broker's account is not undoable. Off by default —
// the write path still runs, but only builds and logs the payload.
export function isBuildiumWriteEnabled() {
  return isBuildiumLive() && process.env.BUILDIUM_WRITES === "true";
}

// Does submitting actually reach the office? True in demo mode (self-consistent
// mock) and in live mode only once writes are on.
export function submissionsReachOffice() {
  return !isBuildiumLive() || isBuildiumWriteEnabled();
}


