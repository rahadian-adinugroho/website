---
title: "Building a Prayer Times & Qibla App in Two Hours"
description: "How I built islam.raharoho.me as a static site with Astro, the adhan library, and a lot of iOS Safari debugging."
date: 2026-06-20
category: engineering-web-apps
draft: false
---

I wanted a simple tool that I could open on any device — phone, laptop, whatever — to check prayer times and Qibla direction without installing an app. No accounts, no ads, no tracking. Just open a URL, allow location, and get the info. That's it.

The result is [islam.raharoho.me](https://islam.raharoho.me). It calculates prayer times based on your current location, shows the Hijri date, and has a Qibla compass that rotates in real-time as you move your phone. The whole thing is a static site hosted on Cloudflare Pages for free.

Here's how it came together, and the surprisingly tricky parts that took most of the time.

## The Stack

The site is built with **Astro 5** and **Tailwind CSS**, consistent with the rest of my monorepo (landing page and blog live in the same repo). Astro outputs a static site — just HTML, CSS, and a small JS bundle. No server, no database, no API calls.

Prayer time calculations use the **adhan** npm package. It's a well-tested library that implements the astronomical algorithms from Jean Meeus's *Astronomical Algorithms*. All calculations happen client-side in the browser — you pass in coordinates and a date, and it returns the prayer times. It also handles Qibla bearing calculation.

For Indonesia, the calculation method is **Kemenag** (Kementerian Agama Republik Indonesia). The `adhan` library doesn't have a dedicated Kemenag method, but the **Singapore method** matches it exactly: Fajr at 20°, Isha at 18°, with the Shafi'i madhab for Asr. I added a +2 minute ihtiyat (precautionary) adjustment to all prayers, which is what Kemenag does in practice.

Deployment is **Cloudflare Pages** via GitHub Actions — same CI/CD pattern as my other sites. Push to main, it builds and deploys. Open a PR, it deploys a preview. Zero cost.

## The Straightforward Parts

The core logic is genuinely simple. Get coordinates from the browser's Geolocation API, pass them to adhan, format the times with `Intl.DateTimeFormat`, display them. The Qibla bearing is a single function call: `Qibla(coordinates)` returns the direction to Mecca in degrees from north.

The theme toggle (light/dark/system) was also straightforward — a small inline script in the layout that checks `localStorage` and `prefers-color-scheme`, plus a button that cycles through the three modes.

Where it got interesting was everything around the edges.

## Finding 1: TypeScript in Inline Scripts Doesn't Get Bundled

The first error I hit was `TypeError: 'text/html' is not a valid JavaScript MIME type`. The browser was trying to fetch `prayer-times.ts` and `qibla.ts` directly as modules, but Astro's static build doesn't bundle TypeScript files imported from inline `<script>` tags — it leaves the import paths as-is, and the server returns HTML (a 404) instead of JavaScript.

The fix was to move all the inline script logic into a separate `app.ts` file and import it with a plain `<script>` tag (no `type="module"`). Astro's Vite integration then properly bundles everything into a single JS file. This is worth knowing if you're using Astro with inline scripts that import TypeScript modules.

## Finding 2: HijriDate Doesn't Exist in adhan

I initially imported `HijriDate` from the adhan package to display the Islamic date. The build failed with `"HijriDate" is not exported by "adhan"`. It turns out the package doesn't export a Hijri date class at all.

First I implemented the Kuwaiti algorithm — a tabular Islamic calendar conversion that's a well-known mathematical formula. It worked, but the date was off by one day compared to what I expected.

The fix was to use the browser's built-in `Intl.DateTimeFormat` with the `islamic` calendar:

```typescript
new Intl.DateTimeFormat("en-US-u-ca-islamic", {
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(date);
```

This uses the browser's locale-aware Islamic calendar implementation, which is more accurate than the tabular algorithm. One gotcha: the output already includes "AH", so don't append it again (I did, and got "Muharram 5, 1448 AH AH").

## Finding 3: Qibla is a Function, Not a Class

The minified error `TypeError: jt.calculate is not a function` took a moment to decode. The `Qibla` export in adhan is a function, not a class with a static method. I was calling `Qibla.calculate(coordinates)` when it should be `Qibla(coordinates)`. A simple fix, but the minified variable name made it harder to spot.

This is also why I added a `MINIFY=false` environment variable to the preview builds — non-minified JS in preview gives you readable stack traces. Production stays minified.

## Finding 4: Static Builds Freeze the Date

The Gregorian date at the top of the page was showing the wrong day. Not wrong by a timezone offset — wrong by a full day. The issue: I was rendering the date server-side in the Astro component with `new Date().toLocaleDateString()`. Since this is a static site, that runs at *build time*, not at page load. The date was frozen to whenever the build ran.

The fix was to move date rendering to the client side — a small JS function that runs on page load and populates the date element. The Hijri date was already client-side (it depends on the user's location for prayer calculations anyway), so it was just the Gregorian date that needed moving.

## Finding 5: Tailwind's `flex` Overrides `hidden`

This one was sneaky. Both the "Request Location" button and the "Unable to access your location" error message were showing at the same time, even though I was setting `hidden = true` on them in JavaScript. The issue: the HTML `hidden` attribute sets `display: none`, but Tailwind's `flex` class sets `display: flex`, and CSS specificity means the class wins over the attribute.

The fix was a single line in global CSS:

```css
[hidden] {
  display: none !important;
}
```

This ensures the `hidden` attribute always wins, regardless of what display utility classes are applied.

## Finding 6: iOS Safari Geolocation is a Minefield

This was the hardest part. The app worked fine on desktop browsers, but on iOS Safari the location prompt never appeared. Here's what I learned:

**iOS Safari requires a user gesture for `getCurrentPosition`.** If you call it on page load without a user tap, iOS silently denies it. No prompt, no error — just a silent denial that gets *cached*. Once that denial is cached, even subsequent calls from button taps fail with `PERMISSION_DENIED` without ever showing the prompt.

I spent a while trying to use `navigator.permissions.query()` to check the permission state before auto-requesting. On desktop, this works great — if the state is "granted", auto-request; otherwise, show the button. But iOS Safari's `permissions.query` for geolocation is unreliable. It can return "denied" even when the user has never been asked, which silently blocks `getCurrentPosition` from showing the prompt.

The final approach: on iOS, always show the button and never auto-request. The user tap satisfies the gesture requirement, and the native prompt appears as expected. On non-iOS browsers, use `permissions.query` to auto-request if already granted.

**Debugging iOS Safari** required connecting my iPhone to my Mac via USB and using Safari's Web Inspector (Develop menu → device name). I added `console.log` statements at every step — init, permission state, button clicks, `getCurrentPosition` calls, success/error results. That's how I saw the `geolocation error: 1 "User denied Geolocation"` message that confirmed the cached denial.

And honestly? Part of the issue was on me. I'd been testing earlier versions that auto-requested on page load, which triggered the silent denial. When I finally fixed the code, iOS had already cached the denial. The fix wasn't in the code — it was in iOS Settings → Privacy & Security → Location Services → Safari → "While Using App". I'd forgotten to enable Location Services for Safari in the first place. Classic.

The error message now includes those instructions for anyone else who hits the same wall.

## Finding 7: Compass Heading is Not `event.alpha`

The Qibla compass wasn't pointing the right direction. The initial implementation used `event.alpha` from `DeviceOrientationEvent` as the compass heading. But `alpha` is not a true compass heading — it's the device's rotation around the z-axis, and it's counterclockwise. It's also only meaningful when `event.absolute` is true (meaning it's relative to Earth, not an arbitrary reference frame).

The correct approach depends on the platform:

- **iOS**: `event.webkitCompassHeading` gives the true compass heading (0 = north, clockwise). This is what you want.
- **Android**: When `event.absolute` is true, the compass heading is `360 - event.alpha`. When it's false, the reading is unreliable and should be skipped.

I also added a listener for `deviceorientationabsolute` on non-iOS devices, which fires when the device provides absolute orientation data. More accurate than the regular `deviceorientation` event.

## The Qibla Compass UX

On iOS, accessing the compass requires an explicit permission request via `DeviceOrientationEvent.requestPermission()`. This has to be triggered by a user gesture (a button tap), similar to the geolocation requirement. So after location is granted, iOS users see an "Enable Compass" button. On Android, the compass just works once location is granted.

The compass itself is a simple SVG arrow that rotates based on the difference between the Qibla bearing and the device's current heading. It updates in real-time as you turn your phone. The whole thing is hidden on desktop since there's no compass hardware.

## What's Next

The app works, but there's more I'd like to add:

- **Configurable calculation method.** Right now it's hardcoded to the Singapore/Kemenag method. A settings panel with localStorage persistence would let users pick their preferred method (MWL, ISNA, Egypt, etc.) and madhab (Shafi vs Hanafi for Asr).
- **Additional prayers.** Dhuha, Tahajjud, the last third of the night. The adhan library supports these via `SunnahTimes`.
- **Notifications.** A reminder before each prayer time. This would need the Notifications API and maybe a service worker.
- **PWA support.** Installable on the home screen, works offline. The site is already static so it's mostly a manifest + service worker away.
- **Qibla accuracy indicator.** Show how confident the compass reading is based on the accuracy value from the device orientation event.

## A Note on How This Was Built

The entire app — from scaffolding to the final bug fix — was coded by AI (Claude, via OpenCode). I described what I wanted, made decisions on the stack and calculation method, and tested on my devices. The AI wrote the code, I reviewed and tested each iteration.

The whole thing took about two hours. Most of that time was spent on the iOS Safari geolocation debugging — the actual code is straightforward, but the platform quirks required iteration with real device testing. The AI was fast at implementing fixes once I described the symptoms, but identifying the root cause (cached denials, user gesture requirements, `webkitCompassHeading` vs `alpha`) required actual device debugging and console logs.

This is the kind of project where AI shines: well-defined scope, standard libraries, clear acceptance criteria. The tricky parts weren't algorithmic — they were platform-specific quirks that needed empirical testing. For those, there's no substitute for plugging in a phone and reading the console.
