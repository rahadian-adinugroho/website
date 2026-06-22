import { getUserLocation, markServerSynced } from "../lib/location";
import { getLocale } from "../i18n/i18n";
import { loadSettings, resolveMethod } from "../lib/settings";

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

/** Build the request body shared by subscribe/preferences/sync calls. */
function buildBody(
  sub: { endpoint: string; keys?: { p256dh: string; auth: string } },
  prefs: PushPrefs,
): Record<string, unknown> {
  const loc = getUserLocation();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const settings = loadSettings();
  const calcMethod = resolveMethod(settings, loc?.lat, loc?.lng);

  const body: Record<string, unknown> = {
    endpoint: sub.endpoint,
    keys: sub.keys,
    timezone,
    prefs,
    locale: getLocale(),
    calcMethod,
  };
  if (loc) {
    body.lat = loc.lat;
    body.lng = loc.lng;
  }
  return body;
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
  let subscription: PushSubscription;
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  } catch (err) {
    if (err instanceof DOMException) {
      if (err.name === "AbortError") {
        console.error(
          "[push] Push service rejected the subscription. This can happen if:\n" +
          "  1. The browser's push service is blocked (firewall, VPN, network policy)\n" +
          "  2. The VAPID public key is invalid or not accepted by the push service\n" +
          "  3. The browser has push disabled (check browser settings, not just permission)\n" +
          "  4. A browser extension is interfering with Web Push\n" +
          "Try: reloading the page, checking your network, or trying a different browser."
        );
      } else if (err.name === "NotAllowedError") {
        console.error("[push] Notification permission was denied. The user must grant notification permission for the site.");
      } else {
        console.error(`[push] Subscription failed: ${err.name} — ${err.message}`);
      }
    } else {
      console.error("[push] Subscription failed with non-DOM error:", err);
    }
    throw err; // Re-throw so the caller knows it failed
  }

  // Send to worker
  const sub = subscription.toJSON();
  const body = buildBody(sub, prefs);

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

  const sub = subscription.toJSON();
  const body = buildBody(sub, prefs);

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

/**
 * Lightweight sync: re-send current state to the Worker without
 * re-prompting for permission or re-subscribing PushManager.
 * Only does something if the user already has a push subscription.
 * On success, marks the server sync timestamp.
 */
export async function syncServerState(prefs: PushPrefs): Promise<void> {
  const subscription = await getPushSubscription();
  if (!subscription) return;

  try {
    const sub = subscription.toJSON();
    const body = buildBody(sub, prefs);

    const res = await fetch(`${WORKER_URL}/api/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`[push] sync failed: ${res.status}`);
    }

    markServerSynced();
    console.log("[push] server state synced");
  } catch (err) {
    console.warn("[push] failed to sync server state", err);
  }
}
