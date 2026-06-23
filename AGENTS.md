# AGENTS.md

Context for AI agents working in this repository. Read this first before making changes.

## What this is

Personal website monorepo. Three static Astro sites, each with its own `package.json`:

| Directory | Domain | What it is |
|---|---|---|
| `landing/` | raharoho.me | Homepage |
| `blog/` | blog.raharoho.me | Writing |
| `islam/` | islam.raharoho.me | Prayer times + Qibla PWA |

The root has no source code — just config and this file. Always `cd` into the right subdirectory before running anything.

## Tech stack

- **Astro 5** — static site generator
- **Tailwind CSS** — utility-first CSS
- **Bun** — package manager (use `bun`, never `npm` or `yarn`)
- **Vitest** — unit tests (only in `islam/`)
- **Cloudflare Pages** — hosting
- **GitHub Actions** — CI/CD (`.github/workflows/`)

## Common commands

```bash
# Install + dev
cd landing && bun install && bun run dev      # → localhost:4321
cd blog    && bun install && bun run dev
cd islam   && bun install && bun run dev

# Build
cd <project> && bun run build    # → dist/

# Test (islam only)
cd islam && bun run test             # one-shot
cd islam && bun run test:watch
cd islam && bun run test:coverage    # informational, not a CI gate

# Typecheck
cd islam && bunx tsc --noEmit
```

## Key files

### `islam/` (the PWA — most complex)

- `src/pages/index.astro` — main page
- `src/components/PrayerTimes.astro` — prayer times display + countdown
- `src/components/QiblaCompass.astro` — Qibla compass with rotating SVG arrow + 🕋 Kaaba emoji at the tip
- `src/components/Settings.astro` — settings panel (calc method, language, push notif)
- `src/scripts/app.ts` — main client init (geolocation, SW registration, sync)
- `src/scripts/prayer-times.ts` — prayer time display logic
- `src/scripts/qibla.ts` — Qibla compass (uses `adhan`'s `Qibla()`)
- `src/scripts/push.ts` — push notification subscribe/unsubscribe
- `src/lib/settings.ts` — settings types, defaults, persistence (localStorage)
- `src/lib/location.ts` — location handling with cache + drift detection
- `src/i18n/i18n.ts` + `en.json` / `id.json` — internationalization
- `public/sw.js` — service worker (push, notificationclick — no fetch handler)
- `public/manifest.json` — PWA manifest (PNG icons only, no SVG)
- `public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon.svg`, `logo-mask.png` — icons

### `blog/`

- `src/content/posts/*.md` — blog posts (frontmatter + markdown)
- `src/content/config.ts` — content collection schema
- `src/pages/index.astro` — index page (with category groups)
- `src/pages/category/[category].astro` — category listing

### `landing/`

- `src/pages/index.astro` — landing page

## Conventions

- **Branch workflow**: branch off `main`, open a PR, never push to main
- **Co-authored-by trailer** — every AI-generated commit must end with:
  ```
  Co-authored-by: MiniMax-M3 (OpenCode Go) <noreply@MiniMax.local>
  ```
- **i18n**: any new user-facing string must be added to BOTH `islam/src/i18n/en.json` and `islam/src/i18n/id.json`
- **TypeScript**: strict mode, no `any` unless necessary
- **Tests**: only `islam/` has tests. Use `vi.mock` / `vi.spyOn` for mocking. Add tests for new logic
- **PN timing**: the PWA's prayer calculation method MUST match what the push Worker uses. If the PWA uses `singapore` with ihtiyat adjustments, the Worker must too — otherwise PNs fire at the wrong time

## Related repos

- **[islam-push-worker](https://github.com/rahadian-adinugroho/islam-push-worker)** — Cloudflare Worker for push notifications. Cron every minute (`* * * * *`), uses `adhan` + `@photostructure/tz-lookup`. Deploy order: Worker first (D1 migration + ihtiyat fix), then Website.

## Common tasks

### Write a blog post

1. Create `blog/src/content/posts/<slug>.md` with frontmatter (title, description, date, category, draft)
2. Write markdown content
3. `cd blog && bun run build` to verify
4. Open a PR

### Fix a PWA bug

1. Identify the file (component in `src/components/` or script in `src/scripts/`)
2. Make the fix + add a test in the relevant test file
3. `cd islam && bun run test` and `bun run build`
4. Open a PR

### Add an i18n string

1. Add the key to both `islam/src/i18n/en.json` and `islam/src/i18n/id.json`
2. Use in the component/script with `t("key.name")`

## Gotchas

- The PWA is purely client-side — no backend in this repo
- Push notifications require the separate Worker repo (see Related repos)
- The service worker has NO `fetch` handler — only `push` and `notificationclick`. Offline is handled by browser HTTP cache, not SW
- PWA manifest icons must be PNG (SVG causes two apps to install on Android)
- iOS fills transparent PNG corners with black — icons must have an opaque background
- The `QiblaCompass.astro` SVG arrow rotates via inline `style.transform` — the 🕋 emoji is inside the SVG so it rotates with the arrow
