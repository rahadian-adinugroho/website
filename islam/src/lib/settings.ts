import { CalculationMethod } from "adhan";

export type CalcMethod =
  | "automatic"
  | "singapore"
  | "ummAlQura"
  | "muslimWorldLeague"
  | "egyptian"
  | "karachi"
  | "northAmerica"
  | "tehran";

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
  if (/^tr/i.test(locale)) return "muslimWorldLeague";
  if (/^en/i.test(locale)) return "muslimWorldLeague";
  return "muslimWorldLeague";
}

/** Detect method from coordinates (more reliable than locale). */
export function detectMethodFromCoordinates(
  lat: number,
  lng: number,
): Exclude<CalcMethod, "automatic"> {
  // Indonesia: lat -11 to 6, lng 95 to 141
  if (lat >= -11 && lat <= 6 && lng >= 95 && lng <= 141) return "singapore";
  // Malaysia/Singapore/Brunei: lat 1 to 7, lng 100 to 119
  if (lat >= 1 && lat <= 7 && lng >= 100 && lng <= 119) return "singapore";
  // Arabian Peninsula: lat 12 to 37, lng 34 to 60
  if (lat >= 12 && lat <= 37 && lng >= 34 && lng <= 60) return "ummAlQura";
  // Pakistan: lat 24 to 37, lng 61 to 78
  if (lat >= 24 && lat <= 37 && lng >= 61 && lng <= 78) return "karachi";
  // Iran: lat 25 to 40, lng 44 to 63
  if (lat >= 25 && lat <= 40 && lng >= 44 && lng <= 63) return "tehran";
  // North America (rough): lat 25 to 70, lng -170 to -50
  if (lat >= 25 && lat <= 70 && lng >= -170 && lng <= -50)
    return "northAmerica";
  return "muslimWorldLeague";
}

/** Resolve "automatic" to a concrete method. Cross-checks locale and
 * coordinates — coordinates are more authoritative when both are available. */
export function resolveMethod(
  settings: Settings,
  lat?: number,
  lng?: number,
): Exclude<CalcMethod, "automatic"> {
  if (settings.calcMethod !== "automatic") {
    return settings.calcMethod;
  }
  const localeMethod = detectMethodFromLocale(navigator.language);
  console.log(
    "[islam] locale:",
    navigator.language,
    "→ locale method:",
    getAdhanMethodName(localeMethod),
  );

  // If we have coordinates, cross-check. Coordinates are more authoritative
  // than browser language (e.g., an English-speaking user in Indonesia
  // should get Singapore method, not MWL).
  if (lat !== undefined && lng !== undefined) {
    const coordMethod = detectMethodFromCoordinates(lat, lng);
    console.log(
      "[islam] coords:",
      lat,
      lng,
      "→ coord method:",
      getAdhanMethodName(coordMethod),
    );
    if (coordMethod !== localeMethod) {
      console.log(
        "[islam] locale and coords disagree → using coords (more accurate)",
      );
      return coordMethod;
    }
    console.log("[islam] locale and coords agree → using that method");
    return localeMethod;
  }

  // No coordinates available — fall back to locale
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
