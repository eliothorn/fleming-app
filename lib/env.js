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

// Raising a work order is the only write that reaches outside the office —
// Buildium can email the contractor. So it sits behind its own switch on top of
// BUILDIUM_WRITES, the same way live reads sit behind one on top of the keys.
// Until it is on, assigning a contractor in the app is an app-only note and the
// Assign screen has to say so.
export function isBuildiumWorkOrderWriteEnabled() {
  return isBuildiumWriteEnabled() && process.env.BUILDIUM_WRITE_WORKORDERS === "true";
}

// Does a completed inspection report also go to the property's owner?
//
// It used to, always. The broker asked for owners to come off on 2026-10-12
// ("can we remove the owners for now"), and "for now" is the operative phrase:
// this is a switch rather than deleted code, so putting them back is an env
// change and not a release. Off by default, which is the state he asked for.
export function isOwnerOnInspectionReport() {
  return process.env.INSPECTION_REPORT_OWNERS === "true";
}

// Emailing residents is the furthest-reaching thing this app can do, and the
// only one that cannot be undone at all: 619 people either received a message
// from their landlord or they did not. It also needs the broker's permission,
// which is his to give and has not been given yet. So the send path sits behind
// its own switch, off by default, the same way work-order writes do.
//
// Reading the rollout numbers is always allowed — knowing how many residents
// could be invited is how the conversation with the broker gets started.
export function isResidentRolloutEnabled() {
  return process.env.RESIDENT_ROLLOUT === "true";
}

// Does an assignment actually reach Buildium? True in demo mode (self-consistent
// mock), and in live mode only once work-order writes are on.
export function assignmentsReachBuildium() {
  return !isBuildiumLive() || isBuildiumWorkOrderWriteEnabled();
}

// Does submitting actually reach the office? True in demo mode (self-consistent
// mock) and in live mode only once writes are on.
export function submissionsReachOffice() {
  return !isBuildiumLive() || isBuildiumWriteEnabled();
}


