"use client";

// Browser side of push notifications.
//
// The awkward part is iOS. Web push works there only from iOS 16.4, and only
// once the app has been added to the Home Screen — in a normal Safari tab
// Notification.requestPermission() either doesn't exist or resolves to a
// permission that never delivers anything. So this reports *why* notifications
// aren't available, and the UI tells someone to install the app rather than
// showing them a button that would quietly do nothing.

const b64ToUint8 = (base64) => {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

// Installed to the home screen? Both spellings matter: iOS uses navigator.standalone,
// everything else uses the display-mode media query.
export function isInstalled() {
  if (typeof window === "undefined") return false;
  return window.navigator.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true;
}

const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
   (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

// What state notifications are in for this device, and what the person can do
// about it. Returns one of: unsupported | needs-install | blocked | off | on
export function pushState() {
  if (typeof window === "undefined") return "unsupported";

  // Inside the App Store build there is no service worker and no PushManager,
  // but notifications work perfectly well through APNs. Checking for the web
  // APIs there would report "unsupported" on the one build where it is most
  // supported, so native short-circuits everything below.
  if (window.Capacitor?.isNativePlatform?.()) return "native";

  const hasApi = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  // On iPhone the API only exists inside the installed app, so a missing API
  // there means "add it to your home screen", not "your phone can't do this".
  if (!hasApi) return isIOS() && !isInstalled() ? "needs-install" : "unsupported";
  if (isIOS() && !isInstalled()) return "needs-install";

  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission === "granted") return "on";
  return "off";
}

export async function currentSubscription() {
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch { return null; }
}

export async function enablePush() {
  const state = pushState();
  if (state === "native") {
    const { registerNativePush } = await import("./native.js");
    return registerNativePush();
  }
  if (state === "needs-install") {
    return { error: "Add the app to your home screen first, then turn notifications on from there." };
  }
  if (state === "unsupported") return { error: "This device can't do notifications." };
  if (state === "blocked") {
    return { error: "Notifications are blocked in your phone's settings for this app. Turn them back on there." };
  }

  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return { error: "Notifications aren't set up on the server yet." };

  try {
    // Must be called from a tap. Safari in particular refuses a permission
    // prompt that isn't tied to a user gesture.
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { error: "You said no to notifications. You can change that any time." };

    const reg = await navigator.serviceWorker.ready;
    // userVisibleOnly is required by every browser: a push must result in a
    // notification the person can see, not silent background work.
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToUint8(key),
    });

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: json.error || "Couldn't turn notifications on." };
    return { ok: true, devices: json.devices };
  } catch (e) {
    return { error: e?.message || "Couldn't turn notifications on." };
  }
}

export async function disablePush() {
  try {
    // The native build has no web subscription to unsubscribe from; clearing the
    // server row is the whole job, and the phone's own settings control the rest.
    if (typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.()) {
      await fetch("/api/push/subscribe", { method: "DELETE" });
      return { ok: true };
    }
    const sub = await currentSubscription();
    if (sub) {
      await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, { method: "DELETE" });
      await sub.unsubscribe();
    } else {
      await fetch("/api/push/subscribe", { method: "DELETE" });
    }
    return { ok: true };
  } catch (e) { return { error: e?.message || "Couldn't turn them off." }; }
}
