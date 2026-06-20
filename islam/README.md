# Islam Prayer Times & Qibla Compass

A lightweight, privacy-focused web app for prayer times and Qibla direction. Built with Astro 5 + Tailwind CSS.

## Features

- Prayer times based on your location (geolocation API)
- Qibla compass with device orientation
- Multiple calculation methods (Singapore/Kemenag, Umm al-Qura, MWL, etc.)
- Sunnah prayer times (Dhuha, Middle of Night, Last Third)
- Live countdown to next prayer
- Dark/light theme toggle
- Internationalization (English + Indonesian)
- No tracking, no ads, no external API calls

## Tech Stack

- **Astro 5** — static site generator
- **Tailwind CSS** — utility-first CSS
- **adhan** — prayer time calculation library
- **Vitest** — unit testing
- **TypeScript** — type safety

## Project Structure

```
islam/
├── src/
│   ├── components/       # Astro components (PrayerTimes, QiblaCompass, Settings, ThemeToggle)
│   ├── layouts/          # Layout.astro (base layout)
│   ├── lib/              # Shared utilities (settings.ts)
│   ├── pages/            # Astro pages (index.astro)
│   ├── scripts/          # Client-side TypeScript (app.ts, prayer-times.ts, qibla.ts, settings.ts)
│   ├── styles/           # Global CSS
│   └── i18n/             # Internationalization (i18n.ts, en.json, id.json)
├── public/               # Static assets (favicon.svg)
├── astro.config.mjs      # Astro configuration
├── vitest.config.ts      # Vitest configuration
└── package.json
```

## Development

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview

# Run tests
bun run test

# Run tests with coverage
bun run test:coverage
```

## Localization Guide

### Overview

The app uses a lightweight custom i18n module (~80 lines) with no external dependencies. All translatable strings are tagged with `data-i18n="key"` attributes in the HTML. At runtime, the i18n module walks the DOM and replaces text content based on the active locale.

**Current locales:** English (`en`), Indonesian (`id`)

**Persistence:** Locale choice is stored in `localStorage` under key `islam:lang`.

**Fallback chain:** Current locale → English → key itself (if not found).

### Adding a New Language

#### Step 1: Create the dictionary file

Copy the English dictionary and translate all keys:

```bash
cp src/i18n/en.json src/i18n/<locale>.json
```

Replace `<locale>` with the language code (e.g., `ms` for Malay, `ar` for Arabic, `tr` for Turkish).

**Important:** Keep the same JSON structure and all keys. Only translate the values.

#### Step 2: Update the i18n module

Edit `src/i18n/i18n.ts`:

1. Add the new locale to the `Locale` type:
   ```ts
   export type Locale = "en" | "id" | "<locale>";
   ```

2. Import the new dictionary:
   ```ts
   import <locale> from "./<locale>.json";
   ```

3. Add it to the `dictionaries` map:
   ```ts
   const dictionaries: Record<Locale, Translation> = { en, id, <locale> };
   ```

4. Update `detectLocale()` to recognize the new locale:
   ```ts
   if (browser.startsWith("<locale>")) return "<locale>";
   ```

#### Step 3: Add language option to Settings

Edit `src/components/Settings.astro` and add a new radio button in the Language section:

```html
<label class="settings-option flex items-center gap-3 py-2 cursor-pointer">
  <input type="radio" name="settings-lang" value="<locale>" class="accent-primary-600 shrink-0" />
  <span class="text-sm text-gray-900 dark:text-gray-100" data-i18n="settings.lang.<locale>"><Language Name></span>
</label>
```

#### Step 4: Add language name to all dictionaries

Add the language name key to **all** dictionary files (`en.json`, `id.json`, and the new `<locale>.json`):

```json
"settings.lang.<locale>": "<Language Name>"
```

For example, for Malay (`ms`):
- `en.json`: `"settings.lang.ms": "Malay"`
- `id.json`: `"settings.lang.ms": "Melayu"`
- `ms.json`: `"settings.lang.ms": "Bahasa Melayu"`

#### Step 5: Test

```bash
# Run tests (includes dictionary parity checks)
bun run test

# Build to verify no errors
bun run build

# Manual test: switch to the new language in Settings and verify all UI updates
bun run dev
```

### Translation Keys Reference

All translatable strings use the `data-i18n` attribute. The i18n module supports three attribute types:

- `data-i18n="key"` — replaces `textContent`
- `data-i18n-aria-label="key"` — sets `aria-label` attribute
- `data-i18n-content="key"` — sets `content` attribute (for meta tags)

**Key categories:**

| Category | Keys | Purpose |
|---|---|---|
| `page.*` | `page.title` | Page title |
| `meta.*` | `meta.description` | Meta description |
| `tabs.*` | `tabs.prayerTimes`, `tabs.qibla` | Tab labels |
| `card.*` | `card.nextPrayer` | Next prayer card |
| `location.*` | `location.allowPrompt`, `location.requestBtn`, `location.retryBtn`, `location.errorDefault`, `location.errorDeniedIos`, `location.errorUnavailable`, `location.errorTimeout` | Location request/error UI |
| `prayer.*` | `prayer.heading`, `prayer.fajr`, `prayer.sunrise`, `prayer.dhuhr`, `prayer.asr`, `prayer.maghrib`, `prayer.isha`, `prayer.dhuha`, `prayer.middleOfNight`, `prayer.lastThirdOfNight`, `prayer.tomorrow` | Prayer names and labels |
| `qibla.*` | `qibla.heading`, `qibla.label`, `qibla.aboutAccuracy`, `qibla.calibrationTitle`, `qibla.calibrationGuide`, `qibla.enableCompass` | Qibla compass UI |
| `settings.*` | `settings.title`, `settings.language`, `settings.calcMethod`, `settings.calcMethod.automatic`, `settings.calcMethod.using`, `settings.calcMethod.singapore`, `settings.calcMethod.ummAlQura`, `settings.calcMethod.muslimWorldLeague`, `settings.calcMethod.egyptian`, `settings.calcMethod.karachi`, `settings.calcMethod.northAmerica`, `settings.calcMethod.tehran`, `settings.calcMethod.turkey`, `settings.sunnahPrayers`, `settings.lang.en`, `settings.lang.id` | Settings panel |
| `hijri.*` | `hijri.months` | Hijri date formatting (pipe-separated month names) |
| `aria.*` | `aria.openSettings`, `aria.closeSettings`, `aria.closeCalibration`, `aria.toggleTheme` | Accessibility labels |

### Interpolation

Use `{var}` placeholders for dynamic values:

```json
"prayer.tomorrow": "{name} (tomorrow)",
"settings.calcMethod.using": "Using: {method}"
```

```ts
t("prayer.tomorrow", { name: "Fajr" }) // "Fajr (tomorrow)"
t("settings.calcMethod.using", { method: "Singapore / Kemenag" }) // "Using: Singapore / Kemenag"
```

### Testing Translations

The test suite includes **dictionary parity checks** to ensure all keys exist in all locales:

```bash
bun run test
```

If a key is missing in a locale, the test will fail with a clear error message. Add the missing key to the dictionary.

### Hijri Date Localization

The Hijri date uses `Intl.DateTimeFormat` with `calendar: "islamic-tbla"`. If the browser doesn't support this, a manual fallback algorithm uses the `hijri.months` key from the active dictionary.

**Format:** Pipe-separated month names (12 months):

```json
"hijri.months": "Muharram|Safar|Rabi' al-Awwal|Rabi' al-Thani|Jumada al-Awwal|Jumada al-Thani|Rajab|Sha'ban|Ramadan|Shawwal|Dhu al-Qi'dah|Dhu al-Hijjah"
```

Indonesian version:

```json
"hijri.months": "Muharram|Safar|Rabiul Awal|Rabiul Akhir|Jumadil Awal|Jumadil Akhir|Rajab|Sya'ban|Ramadan|Syawal|Dzulkaidah|Dzulhijjah"
```

## Architecture Notes

### i18n Module API

```ts
// Detect locale from localStorage or browser
detectLocale(): Locale

// Set locale, persist, apply to DOM, dispatch event
setLocale(locale: Locale): void

// Get current locale
getLocale(): Locale

// Translate a key with optional interpolation
t(key: string, params?: Record<string, string | number>): string

// Walk DOM and apply translations
apply(): void

// Initialize on page load
initI18n(): void
```

**Event:** `locale:changed` is dispatched when the locale changes. Components can listen to re-render locale-dependent content (e.g., Hijri date).

### Settings Persistence

Settings are stored in `localStorage` under key `islam:settings` (versioned schema).

**Current schema (version 1):**

```ts
interface Settings {
  version: 1;
  calcMethod: CalcMethod;
  sunnahPrayers: Record<SunnahPrayer, boolean>;
}
```

**Locale** is stored separately under key `islam:lang` (not part of the settings object).

### Prayer Time Calculation

Uses the `adhan` library with locale-based method detection:

| Locale | Method |
|---|---|
| Indonesian (`id`), Malay (`ms`) | Singapore / Kemenag |
| Arabic (`ar`) | Umm al-Qura |
| Urdu (`ur`), Bengali (`bn`) | Karachi |
| Persian (`fa`) | Tehran |
| Turkish (`tr`) | Turkey (Diyanet) |
| English (`en`) | Muslim World League |

**Coordinate-based fallback** is more reliable than locale (essential for travelers). The app uses bounding boxes for Muslim-majority regions: Egypt, Turkey, Iran, Pakistan, Indonesia, Malaysia, Arabian Peninsula, Middle East, North America, etc.

**Singapore method adjustments:** When the Singapore/Kemenag method is resolved, `ihtiyat` (precautionary) adjustments are applied:

| Prayer | Adjustment (minutes) |
|---|---|
| Fajr | +2 |
| Sunrise | −2 |
| Dhuhr | +2 |
| Asr | +2 |
| Maghrib | +2 |
| Isha | +2 |

### Qibla Compass

Uses `DeviceOrientationEvent` API:

- **iOS:** Requires explicit permission via `DeviceOrientationEvent.requestPermission()`. Permission is cached after first grant.
- **Android:** Uses `deviceorientationabsolute` when available, falls back to `deviceorientation`.
- **Accuracy tracking:** Threshold-gated events (20° boundary) to prevent flickering.
- **CPU optimization:** Compass listener is destroyed when Qibla tab is hidden (saves ~19% CPU on iOS).

### CPU Optimization

- **Tab lifecycle:** Qibla compass listener is destroyed when tab is hidden, re-initialized when shown.
- **Arrow rotation:** Uses incremental deltas + deadband (0.5°) to prevent jitter from sensor noise.
- **DOM writes:** Deferred to `requestAnimationFrame` to batch with other visual updates.
- **Hidden attribute:** Uses `[hidden]` CSS rule with `!important` to prevent Tailwind `flex`/`hidden` class conflicts.

### Known Limitations

- **Dubai (UAE):** Gets Tehran method due to Iran bounding box overlap (lng 54–56). Fix would require sacrificing eastern Iran coverage.
- **Hijri date:** Uses tabular Islamic calendar (`islamic-tbla`), which may differ by ±1 day from local moon sighting.
- **Compass accuracy:** iOS compass accuracy is typically 10–20° after calibration. Android varies by device.
- **Geolocation:** Requires HTTPS and user permission. Some browsers (Safari) may cache denied permissions.

## Deployment

Deployed to Cloudflare Pages:

- **Preview deployments:** On every PR
- **Production:** On merge to `main`

**Domain:** islam.raharoho.me

## Future Work

- **Astro i18n routing** (`/en/...`, `/id/...`) for SEO. Requires SSR or build-time locale variants.
- **PWA with push notifications** for prayer time reminders. Would require Cloudflare Workers + D1.
- **Additional languages:** Malay, Arabic, Turkish, Urdu (follow the localization guide above).
- **Configurable settings UI:** Prayer notification toggles, adhan sound selection, etc.

## License

Personal project. No license specified.
