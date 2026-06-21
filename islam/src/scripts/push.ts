import { getUserLocation } from "../lib/location";
import { getLocale } from "../i18n/i18n";

const VAPID_PUBLIC_KEY = "BO52m2RzNMPmB1E8ZeShL6uDgtx8qjSHjwkW7nt5AP2kqPUhilePDf_Vki89XUB3nqQ63jv7qBYaLqkgcDWi-DY";
const WORKER_URL = "https://islam-push.raharoho.me";

export interface PushPrefs {
  fajr: boolean;
  dhuhr: boolean;
  asr: boolean;
  maghrib: boolean;
  isha: boolean;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData.split("").map((c) => c.charCodeAt(0)));
}

export async function enableNotifications(prefs: PushPrefs): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("[push] Push notifications not supported");
    return;
  }

  // Request permission
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.warn("[push] Notification permission denied");
    return;
  }

  // Get registration — the SW should already be registered by app.ts
  const registration = await navigator.serviceWorker.ready;

  // Subscribe
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  // Get user location and timezone
  const loc = getUserLocation();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Send to worker — Worker expects flat fields (endpoint, keys at top level)
  const sub = subscription.toJSON();
  const body: Record<string, unknown> = {
    endpoint: sub.endpoint,
    keys: sub.keys,
    timezone,
    prefs,
  };
  if (loc) {
    body.lat = loc.lat;
    body.lng = loc.lng;
  }
  body.locale = getLocale();

  const res = await fetch(`${WORKER_URL}/api/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`[push] subscribe failed: ${res.status}`);
  }

  // Store subscribed state
  localStorage.setItem("islam:push:subscribed", "true");
  localStorage.setItem("islam:push:prefs", JSON.stringify(prefs));

  console.log("[push] successfully subscribed");
}

export async function disableNotifications(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    // Notify worker — Worker expects flat fields (endpoint at top level)
    try {
      const sub = subscription.toJSON();
      await fetch(`${WORKER_URL}/api/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
    } catch (err) {
      console.warn("[push] failed to notify worker of unsubscription", err);
    }

    await subscription.unsubscribe();
  }

  localStorage.removeItem("islam:push:subscribed");
  localStorage.removeItem("islam:push:prefs");

  console.log("[push] successfully unsubscribed");
}

/**
 * Check if the user is currently subscribed to push notifications.
 * Returns the subscription object if subscribed, null otherwise.
 */
export async function getPushSubscription(): Promise<PushSubscriptionJSON | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn("[push] failed to get subscription", err);
    return null;
  }
}

interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime: number | null;
}

export async function updatePreferences(prefs: PushPrefs): Promise<void> {
  const subscribed = localStorage.getItem("islam:push:subscribed") === "true";
  if (!subscribed) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const loc = getUserLocation();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Worker expects flat fields (endpoint, keys at top level)
  const sub = subscription.toJSON();
  const body: Record<string, unknown> = {
    endpoint: sub.endpoint,
    keys: sub.keys,
    timezone,
    prefs,
  };
  if (loc) {
    body.lat = loc.lat;
    body.lng = loc.lng;
  }
  body.locale = getLocale();

  try {
    const res = await fetch(`${WORKER_URL}/api/preferences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`[push] update preferences failed: ${res.status}`);
    }

    localStorage.setItem("islam:push:prefs", JSON.stringify(prefs));
    console.log("[push] preferences updated");
  } catch (err) {
    console.warn("[push] failed to update preferences", err);
  }
}
