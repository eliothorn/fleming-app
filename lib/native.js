"use client";

// Running inside the native app, or in a browser?
//
// The same web app serves both. Wrapped in Capacitor it loads flemingrealty.org
// into a WebView with a bridge on window.Capacitor; in Safari or Chrome that
// bridge is simply absent. Everything native is behind that check and behind a
// dynamic import, so a normal browser never loads a line of plugin code.
//
// This matters most for notifications. Web push does not work inside an iOS
// WebView at all: Apple only implements it for Safari and home-screen web apps.
// So the browser build uses web push (VAPID) and the native build has to use
// APNs on iOS and FCM on Android. Two different transports for the same feature,
// picked here.

export function isNative() {
  if (typeof window === "undefined") return false;
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

export function nativePlatform() {
  if (typeof window === "undefined") return "web";
  return window.Capacitor?.getPlatform?.() || "web";
}

// ── Notifications ─────────────────────────────────────────────────────────────
// Returns { ok, token, platform } or { error }. The token is the device's APNs
// or FCM registration, which the server stores exactly as the web push endpoint
// is stored.
export async function registerNativePush() {
  if (!isNative()) return { error: "Not running in the app." };

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") {
      return { error: "You said no to notifications. You can change that in your phone's settings." };
    }

    // register() resolves immediately; the token arrives on an event, so wait for
    // whichever comes first and give up rather than hanging the button forever.
    const token = await new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("The phone didn't return a notification token.")), 15000);
      await PushNotifications.addListener("registration", (t) => { clearTimeout(timer); resolve(t.value); });
      await PushNotifications.addListener("registrationError", (e) => {
        clearTimeout(timer); reject(new Error(e?.error || "Registration failed."));
      });
      await PushNotifications.register();
    });

    const platform = nativePlatform();
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nativeToken: token, platform }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: json.error || "Couldn't register this device." };
    return { ok: true, token, platform, devices: json.devices };
  } catch (e) {
    return { error: e?.message || "Couldn't turn notifications on." };
  }
}

// Tapping a notification should open the job it is about. The web build does this
// in the service worker; native has to be wired to the same behaviour here.
export async function attachNativePushHandlers() {
  if (!isNative()) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const url = action?.notification?.data?.url;
      if (url && typeof window !== "undefined") window.location.assign(url);
    });
  } catch { /* notifications simply will not deep-link; not worth breaking boot over */ }
}

// ── Camera ────────────────────────────────────────────────────────────────────
// The browser uses <input type="file">, which works but opens the OS picker.
// Inside the app this is the real camera, which is both nicer and part of what
// makes this more than a website in a wrapper.
//
// Returns a File so callers can hand it to the same upload path as the web one.
export async function takeNativePhoto({ fromLibrary = false } = {}) {
  if (!isNative()) return { error: "Not running in the app." };
  try {
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: fromLibrary ? CameraSource.Photos : CameraSource.Camera,
      // Long side capped: an inspection photo does not need to be 12 megapixels,
      // and the upload limit is 10MB.
      width: 2000,
    });
    const bin = atob(photo.base64String);
    const bytes = Uint8Array.from([...bin].map((c) => c.charCodeAt(0)));
    const type = `image/${photo.format || "jpeg"}`;
    return { ok: true, file: new File([bytes], `photo.${photo.format || "jpg"}`, { type }) };
  } catch (e) {
    // Cancelling the camera is not an error worth showing.
    if (/cancel/i.test(e?.message || "")) return { cancelled: true };
    return { error: e?.message || "Couldn't take that photo." };
  }
}
