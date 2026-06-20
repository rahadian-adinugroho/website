import { CalculationMethod } from "adhan";

export type CalcMethod =
  | "automatic"
  | "singapore"
  | "ummAlQura"
  | "muslimWorldLeague"
  | "egyptian"
  | "karachi"
  | "northAmerica"
  | "tehran"
  | "turkey";

export type SunnahPrayer = "dhuha" | "middleOfNight" | "lastThirdOfNight";

export type PrayerId =
  | "fajr"
  | "sunrise"
  | "dhuha"
  | "dhuhr"
  | "asr"
  | "maghrib"
  | "isha"
  | "middleOfNight"
  | "lastThirdOfNight";

export interface Settings {
  version: 1;
  calcMethod: CalcMethod;
  sunnahPrayers: Record<SunnahPrayer, boolean>;
}

export const PRAYER_LABELS: Record<PrayerId, string> = {
  fajr: "Fajr",
  sunrise: "Sunrise",
  dhuha: "Dhuha",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
  middleOfNight: "Middle of the Night",
  lastThirdOfNight: "Last Third of the Night",
};

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  calcMethod: "automatic",
  sunnahPrayers: {
    dhuha: false,
    middleOfNight: false,
    lastThirdOfNight: false,
  },
};

/** Detect the best calculation method from browser locale. */
export function detectMethodFromLocale(
  locale: string,
): Exclude<CalcMethod, "automatic"> {
  // Match language-only (id, ms, ar, ur) or language-region (id-ID, ms-MY, etc.)
  if (/^id/i.test(locale) || /^ms/i.test(locale)) return "singapore";
  if (/^ar/i.test(locale)) return "ummAlQura";
  if (/^ur/i.test(locale) || /^bn/i.test(locale)) return "karachi";
  if (/^fa/i.test(locale)) return "tehran";
  if (/^tr/i.test(locale)) return "turkey";
  if (/^en/i.test(locale)) return "muslimWorldLeague";
  return "muslimWorldLeague";
}

/** Detect method from coordinates (more reliable than locale).
 * Muslim-majority regions covered: Egypt, Turkey, Iran, Pakistan/Afghanistan/
 * Bangladesh (Karachi), Indonesia, Malaysia/Singapore/Brunei, Arabian Peninsula
 * (Umm al-Qura), Middle East, North Africa, West Africa, East Africa, Central
 * Asia, China Muslim regions, Thailand/Myanmar, Philippines, North America.
 * Order matters for overlapping regions — more specific methods first. */
export function detectMethodFromCoordinates(
  lat: number,
  lng: number,
): Exclude<CalcMethod, "automatic"> {
  // === Specific methods (higher priority for overlapping regions) ===

  // Egypt
  if (lat >= 22 && lat <= 32 && lng >= 25 && lng <= 36) return "egyptian";

  // Turkey (Diyanet)
  if (lat >= 36 && lat <= 42 && lng >= 26 && lng <= 45) return "turkey";

  // Iran (Tehran)
  if (lat >= 25 && lat <= 40 && lng >= 45 && lng <= 63) return "tehran";

  // Karachi region: Pakistan, Afghanistan, Bangladesh
  if (lat >= 20 && lat <= 39 && lng >= 61 && lng <= 93) return "karachi";

  // Indonesia (Singapore/Kemenag)
  if (lat >= -11 && lat <= 6 && lng >= 95 && lng <= 141) return "singapore";

  // Malaysia / Singapore / Brunei (Singapore method)
  if (lat >= 1 && lat <= 7 && lng >= 100 && lng <= 119) return "singapore";

  // Arabian Peninsula (Umm al-Qura)
  if (lat >= 12 && lat <= 37 && lng >= 34 && lng <= 60) return "ummAlQura";

  // === Muslim World League fallback regions ===

  // Middle East: Iraq, Syria, Jordan, Lebanon, Palestine
  if (lat >= 29 && lat <= 38 && lng >= 34 && lng <= 44)
    return "muslimWorldLeague";

  // North America (ISNA)
  if (lat >= 25 && lat <= 70 && lng >= -170 && lng <= -50)
    return "northAmerica";

  // North Africa + West Africa
  // Morocco, Algeria, Tunisia, Libya, Nigeria, Senegal, Mali, etc.
  if (lat >= 0 && lat <= 37 && lng >= -18 && lng <= 25)
    return "muslimWorldLeague";

  // East Africa: Sudan, Somalia, Ethiopia, Eritrea, Djibouti
  if (lat >= -2 && lat <= 22 && lng >= 21 && lng <= 51)
    return "muslimWorldLeague";

  // Central Asia: Uzbekistan, Tajikistan, Turkmenistan, Kyrgyzstan,
  // southern Kazakhstan
  if (lat >= 35 && lat <= 55 && lng >= 46 && lng <= 87)
    return "muslimWorldLeague";

  // China Muslim regions: Xinjiang, Ningxia, Gansu
  if (lat >= 35 && lat <= 50 && lng >= 73 && lng <= 105)
    return "muslimWorldLeague";

  // Thailand / Myanmar
  if (lat >= 5 && lat <= 28 && lng >= 92 && lng <= 101)
    return "muslimWorldLeague";

  // Philippines
  if (lat >= 5 && lat <= 19 && lng >= 117 && lng <= 127)
    return "muslimWorldLeague";

  // Fallback for unhandled regions
  return "muslimWorldLeague";
}

/** Resolve "automatic" to a concrete method. Coordinates are
 * authoritative — a traveler should follow the prayer times of where
 * they physically are, not where their browser says they are. Locale
 * is only used as a fallback when coordinates are unavailable. */
export function resolveMethod(
  settings: Settings,
  lat?: number,
  lng?: number,
): Exclude<CalcMethod, "automatic"> {
  if (settings.calcMethod !== "automatic") {
    return settings.calcMethod;
  }

  // Coordinates are the most authoritative signal — use them when available.
  // This ensures travelers get local prayer times regardless of browser
  // language (e.g., an Indonesian user traveling in Turkey should get
  // the Diyanet method, not Singapore/Kemenag).
  if (lat !== undefined && lng !== undefined) {
    const coordMethod = detectMethodFromCoordinates(lat, lng);
    console.log(
      "[islam] coords:",
      lat,
      lng,
      "→ method:",
      getAdhanMethodName(coordMethod),
    );
    return coordMethod;
  }

  // No coordinates — fall back to locale
  const localeMethod = detectMethodFromLocale(navigator.language);
  console.log(
    "[islam] locale:",
    navigator.language,
    "→ method:",
    getAdhanMethodName(localeMethod),
  );
  return localeMethod;
}

/** Human-readable names for each method. */
export function getAdhanMethodName(
  method: Exclude<CalcMethod, "automatic">,
): string {
  const names: Record<Exclude<CalcMethod, "automatic">, string> = {
    singapore: "Singapore / Kemenag",
    ummAlQura: "Umm al-Qura",
    muslimWorldLeague: "Muslim World League",
    egyptian: "Egyptian",
    karachi: "Karachi",
    northAmerica: "North America (ISNA)",
    tehran: "Tehran",
    turkey: "Turkey (Diyanet)",
  };
  return names[method];
}

/** Get adhan CalculationMethod parameters for a given concrete method. */
export function getAdhanCalculationMethod(
  method: Exclude<CalcMethod, "automatic">,
) {
  switch (method) {
    case "singapore":
      return CalculationMethod.Singapore();
    case "ummAlQura":
      return CalculationMethod.UmmAlQura();
    case "muslimWorldLeague":
      return CalculationMethod.MuslimWorldLeague();
    case "egyptian":
      return CalculationMethod.Egyptian();
    case "karachi":
      return CalculationMethod.Karachi();
    case "northAmerica":
      return CalculationMethod.NorthAmerica();
    case "tehran":
      return CalculationMethod.Tehran();
    case "turkey":
      return CalculationMethod.Turkey();
  }
}

const STORAGE_KEY = "islam:settings";

export function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.version === 1) return parsed;
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
