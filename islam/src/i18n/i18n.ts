import en from "./en.json";
import id from "./id.json";

export type Locale = "en" | "id";
export type Translation = Record<string, string>;

const dictionaries: Record<Locale, Translation> = { en, id };

let currentLocale: Locale = "en";
let currentDict: Translation = en;

/** Detect locale from localStorage or browser language. */
export function detectLocale(): Locale {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem("islam:lang");
    if (stored === "en" || stored === "id") return stored;
  }
  if (typeof navigator !== "undefined") {
    const browser = navigator.language.toLowerCase();
    if (browser.startsWith("id")) return "id";
  }
  return "en";
}

/** Set locale, persist to localStorage, apply to DOM, dispatch event. */
export function setLocale(locale: Locale): void {
  currentLocale = locale;
  currentDict = dictionaries[locale];
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("islam:lang", locale);
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
    apply();
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("locale:changed"));
  }
}

/** Get current locale. */
export function getLocale(): Locale {
  return currentLocale;
}

/** Translate a key. Falls back to English, then to key itself.
 * Supports {var} interpolation. */
export function t(key: string, params?: Record<string, string | number>): string {
  let text = currentDict[key] ?? en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return text;
}

/** Walk DOM and apply translations to [data-i18n] and [data-i18n-aria-label] elements. */
export function apply(): void {
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria-label");
    if (key) el.setAttribute("aria-label", t(key));
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-content]").forEach((el) => {
    const key = el.getAttribute("data-i18n-content");
    if (key) el.setAttribute("content", t(key));
  });
}

/** Initialize i18n on page load. */
export function initI18n(): void {
  const locale = detectLocale();
  setLocale(locale);
}
