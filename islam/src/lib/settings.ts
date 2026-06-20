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
  if (/^(id|ms)_?(ID|MY|SG)/i.test(locale)) return "singapore";
  if (/^ar_?(SA|YE|OM|AE|KW|BH|QA)/i.test(locale)) return "ummAlQura";
  if (/^ur_PK/i.test(locale) || /^bn_BD/i.test(locale)) return "karachi";
  if (/^fa_IR/i.test(locale)) return "tehran";
  if (/^en_?(GB|IE|AU|NZ|ZA)/i.test(locale)) return "muslimWorldLeague";
  return "muslimWorldLeague";
}

/** Resolve "automatic" to a concrete method based on the browser locale. */
export function resolveMethod(
  settings: Settings,
): Exclude<CalcMethod, "automatic"> {
  if (settings.calcMethod === "automatic") {
    return detectMethodFromLocale(navigator.language);
  }
  return settings.calcMethod;
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
