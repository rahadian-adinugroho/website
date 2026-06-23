---
title: "Why Our PWA Needed a Cloudflare Worker for Prayer Notifications"
description: "A static PWA can compute prayer times locally, but it can't guarantee that a notification fires at the right moment. Here's why we needed a backend — and how the pieces fit together."
date: 2026-06-23
category: engineering-web-apps
draft: false
---

islam.raharoho.me is a PWA. It computes prayer times locally using the `adhan` library, shows a Qibla compass, works offline, and has a clean Astro + Tailwind UI. It's hosted on Cloudflare Pages as a static site — no backend, no server, no database, no API. The whole thing is just HTML, CSS, and JavaScript served from a CDN.

But for prayer notifications, "just a static site" isn't enough. Push notifications are the part that needs a backend. This post is about why, and how the pieces fit together.

## The problem with "just a PWA"

A PWA is still a web page. When you close the tab, the JavaScript stops running. When the OS kills the service worker (which it does, often, especially on iOS), your background tasks die with it. The browser will suspend timers, throttle background fetches, and eventually evict your service worker from memory.

There are APIs for "background" work in PWAs — `setTimeout`, `setInterval`, the Background Sync API, the Periodic Background Sync API, the Web Push API. But they have limitations:

- **`setTimeout` / `setInterval`**: Throttled to 1 minute minimum, suspended when the tab is hidden, killed entirely when the service worker is evicted.
- **Background Sync API**: Fires when the user comes back online. Not a scheduler. Can't be relied on for "fire at 04:30 exactly."
- **Periodic Background Sync API**: Requires user permission, requires the site to be installed as a PWA, and is **not supported in Safari at all** (and has spotty support elsewhere).
- **Web Push API**: This is the one that works, but it requires a *server* to send the push. Browsers don't let PWAs send push notifications to themselves.

For prayer times, none of these is enough. We need a notification to fire at exactly 04:30:00, every day, whether the user has the app open, has their phone on airplane mode, or hasn't touched the app in a week. The only reliable way to do that is a server-side cron job.

## The architecture

islam.raharoho.me is split into two pieces: a static PWA on Cloudflare Pages, and a Cloudflare Worker that sends the notifications.

```
┌─────────────────────────────────────┐
│         Cloudflare Pages             │
│  (Astro static site + PWA shell)     │
│                                     │
│  - HTML/CSS/JS for the UI            │
│  - Service worker (push receiver)    │
│  - adhan (prayer computation)        │
│  - Static assets served from CDN     │
└──────────────────┬──────────────────┘
                   │ HTTPS
                   │ (push subscription, settings)
                   ▼
┌─────────────────────────────────────┐
│       Cloudflare Worker              │
│   (islam-push-worker repo)           │
│                                     │
│  - Cron trigger (* * * * *)          │
│  - adhan (prayer computation)        │
│  - VAPID push delivery               │
│  - D1 database for subscriptions     │
│  - Timezone derivation (geo-tz)      │
└──────────────────┬──────────────────┘
                   │ web-push protocol
                   ▼
       ┌───────────┴───────────┐
       │                       │
       ▼                       ▼
   APNs (iOS)            FCM (Android)
                         Mozilla autopush
                         (Firefox/Brave)
```

### The PWA (Cloudflare Pages)

The PWA is what the user sees and interacts with. It's a static Astro site that:
- Computes prayer times locally (so the UI shows accurate times even when offline)
- Shows a Qibla compass using device orientation
- Lets the user pick their calculation method and language
- Subscribes to push notifications (if the user opts in)
- Caches assets via a service worker for offline use
- Caches the user's last known location in localStorage

The PWA registers a service worker, prompts for notification permission, and sends the resulting `PushSubscription` to the Worker. The Worker stores the subscription along with the user's location, timezone, and calculation preferences.

The PWA does *not* try to schedule the notification itself. The "next prayer" countdown on screen is computed locally (just a `setInterval` that updates a DOM element), but that's the UI — the actual notification comes from the server.

### The Cloudflare Worker (islam-push-worker)

The Worker is a separate repo (`rahadian-adinugroho/islam-push-worker`) deployed to Cloudflare Workers. It has a `scheduled` handler that runs every minute via the cron trigger:

```toml
[triggers]
crons = ["* * * * *"]
```

Every minute, the Worker:
1. Reads all active subscriptions from D1
2. For each subscription, derives the IANA timezone from the stored coordinates (using `@photostructure/tz-lookup`, because the client-provided timezone can be obfuscated by privacy settings)
3. Computes today's prayer times using `adhan` with the user's stored calculation method, applying the Kemenag RI ihtiyat adjustments (+2 minutes)
4. Checks if any prayer is within the next minute (using an epoch comparison so timezone never confuses the math)
5. If yes, sends a VAPID-signed push via `web-push` to the user's subscription endpoint
6. Marks the prayer as notified in D1 to prevent duplicates

The push reaches the user's device through the appropriate push service:
- **iOS Safari** → Apple Push Notification service (APNs)
- **Android Chrome** → Firebase Cloud Messaging (FCM)
- **Firefox / Brave** → Mozilla autopush

The service worker on the user's device receives the push and shows the notification. The PWA doesn't even need to be open.

### The D1 database

D1 is Cloudflare's serverless SQLite. We use it to store subscriptions:

```sql
CREATE TABLE subscriptions (
  endpoint TEXT PRIMARY KEY,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  timezone TEXT NOT NULL,
  locale TEXT NOT NULL,
  calc_method TEXT NOT NULL,
  notify_fajr INTEGER DEFAULT 1,
  notify_dhuhr INTEGER DEFAULT 1,
  notify_asr INTEGER DEFAULT 1,
  notify_maghrib INTEGER DEFAULT 1,
  notify_isha INTEGER DEFAULT 1,
  last_notified_date TEXT,
  last_notified_prayer TEXT
);
```

The PWA sends this when the user subscribes. The Worker reads it every minute. D1 gives us a durable, fast, serverless store that lives next to the Worker.

## Why this shape

The split — PWA for UI, Worker for notifications — is the simplest design that meets the requirements:

- **The PWA stays static.** No Node.js server to maintain, no API to deploy, no database connection pool to tune. The UI is HTML and JS served from a CDN, fast everywhere, including offline.
- **The Worker is the smallest possible "backend."** It's a single file of code, runs every minute, reads from one database, sends one message. No HTTP server, no REST API, no authentication surface. The only "user input" is the push subscription.
- **The push subscription is the contract.** The PWA's only job with the backend is to send a subscription and keep it updated. The Worker's only job is to use that subscription to deliver notifications.
- **The cron is the only stateful piece.** Every minute, "what should I send right now?" is answered by reading the database. No queues, no event buses, no in-memory state.

The total cost is $0. Both Cloudflare Pages and Cloudflare Workers have generous free tiers, and D1's free tier is more than enough for a single-app workload.

## What the PWA can do alone (and why it does)

Even though the notifications need a server, the PWA does as much as possible locally:

- **Prayer time display**: `adhan` is a small (~50KB) pure-JS library. The PWA computes prayer times on the client so the UI is instant and works offline.
- **Qibla compass**: Device orientation events are local. No server needed.
- **Location caching**: The user's last known location is stored in localStorage so the PWA shows prayer times on first load, even before the GPS locks.
- **Offline assets**: The service worker caches HTML, CSS, JS, and icons. The PWA works on an airplane once it's been opened once.
- **Settings**: Calculation method, language, notification preferences — all in localStorage. No account, no server.

The PWA is genuinely useful on its own. The server is the cherry on top: "I noticed you might not have the app open at prayer time. Here's a nudge."

## The boundary I drew

The key decision was: **what runs on the client vs. the server?**

- **Client (PWA)**: anything that improves the in-app experience. Computation, caching, offline. The client is rich; the server is dumb.
- **Server (Worker)**: anything that needs to happen when the client isn't running. Push notifications. The server is the messenger; the client is the message.

This split is what makes the whole thing cheap, fast, and reliable. The PWA can be entirely static — no SSR, no API routes, no backend deployment. The Worker can be entirely focused on its one job. Neither piece has to know about the other's internals beyond a small contract (the push subscription, the cron, the notification payload).

The reason this works at all — and the reason I keep coming back to in my own debugging — is that **the unreliable part (the user's device) and the reliable part (the server) are kept separate**. The PWA can be unreliable — the user might never open it, the service worker might be killed, the browser might suspend it — and it doesn't matter, because the Worker doesn't depend on any of that. The Worker is reliable because it's a single-purpose cron job running in a data center.

Push notifications are the part of a PWA that has to be server-driven. Everything else can (and should) be client-side.
