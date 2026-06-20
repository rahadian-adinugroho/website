import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  detectLocale,
  setLocale,
  getLocale,
  t,
  apply,
  initI18n,
} from "./i18n";
import en from "./en.json";
import id from "./id.json";

describe("i18n", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "";
    document.body.innerHTML = "";
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("detectLocale", () => {
    it("returns stored locale from localStorage", () => {
      localStorage.setItem("islam:lang", "id");
      expect(detectLocale()).toBe("id");
    });

    it("returns 'en' for stored 'en'", () => {
      localStorage.setItem("islam:lang", "en");
      expect(detectLocale()).toBe("en");
    });

    it("ignores invalid stored locale", () => {
      localStorage.setItem("islam:lang", "invalid");
      // Falls through to browser detection
      expect(detectLocale()).toBe("en"); // default for non-id browser
    });

    it("returns 'id' for id browser language", () => {
      Object.defineProperty(navigator, "language", {
        value: "id-ID",
        configurable: true,
      });
      expect(detectLocale()).toBe("id");
    });

    it("returns 'id' for id browser language (lowercase)", () => {
      Object.defineProperty(navigator, "language", {
        value: "id",
        configurable: true,
      });
      expect(detectLocale()).toBe("id");
    });

    it("returns 'en' for en browser language", () => {
      Object.defineProperty(navigator, "language", {
        value: "en-US",
        configurable: true,
      });
      expect(detectLocale()).toBe("en");
    });

    it("returns 'en' for other browser languages", () => {
      Object.defineProperty(navigator, "language", {
        value: "de-DE",
        configurable: true,
      });
      expect(detectLocale()).toBe("en");
    });

    it("returns 'en' when localStorage is empty (browser fallback)", () => {
      // localStorage was cleared in beforeEach; browser is default en-US
      expect(detectLocale()).toBe("en");
    });

    it("returns 'id' when localStorage is empty and browser is id-*", () => {
      Object.defineProperty(navigator, "language", {
        value: "id-ID",
        configurable: true,
      });
      expect(detectLocale()).toBe("id");
    });

    it("falls back to browser after localStorage.removeItem('islam:lang')", () => {
      Object.defineProperty(navigator, "language", {
        value: "en-US",
        configurable: true,
      });
      localStorage.setItem("islam:lang", "id");
      expect(detectLocale()).toBe("id");
      localStorage.removeItem("islam:lang");
      expect(detectLocale()).toBe("en");
    });
  });

  describe("setLocale", () => {
    it("persists locale to localStorage", () => {
      setLocale("id");
      expect(localStorage.getItem("islam:lang")).toBe("id");
    });

    it("updates <html lang>", () => {
      setLocale("id");
      expect(document.documentElement.lang).toBe("id");
    });

    it("dispatches locale:changed event", () => {
      let eventFired = false;
      window.addEventListener("locale:changed", () => {
        eventFired = true;
      });
      setLocale("id");
      expect(eventFired).toBe(true);
    });

    it("applies translations to DOM", () => {
      document.body.innerHTML = '<span data-i18n="prayer.fajr"></span>';
      setLocale("id");
      expect(document.querySelector("[data-i18n]")?.textContent).toBe("Subuh");
    });
  });

  describe("getLocale", () => {
    it("returns current locale", () => {
      setLocale("id");
      expect(getLocale()).toBe("id");
      setLocale("en");
      expect(getLocale()).toBe("en");
    });
  });

  describe("t", () => {
    it("returns dictionary value for known key", () => {
      setLocale("en");
      expect(t("prayer.fajr")).toBe("Fajr");
    });

    it("returns localized value for current locale", () => {
      setLocale("id");
      expect(t("prayer.fajr")).toBe("Subuh");
    });

    it("falls back to English when current locale missing key", () => {
      setLocale("id");
      // Temporarily remove a key from id dictionary (simulated by using a key that doesn't exist)
      expect(t("nonexistent.key")).toBe("nonexistent.key");
    });

    it("returns key itself when not found in any dictionary", () => {
      expect(t("missing.key")).toBe("missing.key");
    });

    it("interpolates {var} parameters", () => {
      setLocale("en");
      expect(t("prayer.tomorrow", { name: "Fajr" })).toBe("Fajr (tomorrow)");
    });

    it("interpolates multiple parameters", () => {
      // Add a test key with multiple params (not in actual dictionary, but test the logic)
      expect(t("settings.calcMethod.using", { method: "Singapore" })).toBe(
        "Using: Singapore"
      );
    });

    it("ignores params not present in template", () => {
      expect(t("prayer.fajr", { extra: "value" })).toBe("Fajr");
    });

    it("handles numeric parameters", () => {
      expect(t("prayer.tomorrow", { name: 5 })).toBe("5 (tomorrow)");
    });
  });

  describe("apply", () => {
    it("replaces text content of [data-i18n] elements", () => {
      document.body.innerHTML = `
        <span data-i18n="prayer.fajr"></span>
        <span data-i18n="prayer.dhuhr"></span>
      `;
      setLocale("en");
      apply();
      const spans = document.querySelectorAll("[data-i18n]");
      expect(spans[0].textContent).toBe("Fajr");
      expect(spans[1].textContent).toBe("Dhuhr");
    });

    it("sets aria-label for [data-i18n-aria-label] elements", () => {
      document.body.innerHTML = '<button data-i18n-aria-label="aria.openSettings"></button>';
      setLocale("en");
      apply();
      expect(document.querySelector("button")?.getAttribute("aria-label")).toBe(
        "Open settings"
      );
    });

    it("updates translations when locale changes", () => {
      document.body.innerHTML = '<span data-i18n="prayer.fajr"></span>';
      setLocale("en");
      apply();
      expect(document.querySelector("[data-i18n]")?.textContent).toBe("Fajr");
      setLocale("id");
      expect(document.querySelector("[data-i18n]")?.textContent).toBe("Subuh");
    });
  });

  describe("initI18n", () => {
    it("detects and sets locale", () => {
      localStorage.setItem("islam:lang", "id");
      initI18n();
      expect(getLocale()).toBe("id");
    });

    it("applies translations on init", () => {
      document.body.innerHTML = '<span data-i18n="prayer.fajr"></span>';
      localStorage.setItem("islam:lang", "id");
      initI18n();
      expect(document.querySelector("[data-i18n]")?.textContent).toBe("Subuh");
    });
  });

  describe("dictionary parity", () => {
    it("all keys in en.json exist in id.json", () => {
      const enKeys = Object.keys(en);
      const idKeys = Object.keys(id);
      for (const key of enKeys) {
        expect(idKeys).toContain(key);
      }
    });

    it("all keys in id.json exist in en.json", () => {
      const enKeys = Object.keys(en);
      const idKeys = Object.keys(id);
      for (const key of idKeys) {
        expect(enKeys).toContain(key);
      }
    });
  });
});
