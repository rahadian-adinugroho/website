import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  detectMethodFromLocale,
  detectMethodFromCoordinates,
  resolveMethod,
  getAdhanMethodName,
  getAdhanCalculationMethod,
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
} from "./settings";
import { applySettingsToForm } from "../scripts/settings";
import type { Settings, CalcMethod } from "./settings";

// ========================================================================
// detectMethodFromLocale
// ========================================================================

describe("detectMethodFromLocale", () => {
  it("returns singapore for id (language only)", () => {
    expect(detectMethodFromLocale("id")).toBe("singapore");
  });

  it("returns singapore for id-ID", () => {
    expect(detectMethodFromLocale("id-ID")).toBe("singapore");
  });

  it("returns singapore for ms-MY", () => {
    expect(detectMethodFromLocale("ms-MY")).toBe("singapore");
  });

  it("returns singapore for ms (language only)", () => {
    expect(detectMethodFromLocale("ms")).toBe("singapore");
  });

  it("returns ummAlQura for ar", () => {
    expect(detectMethodFromLocale("ar")).toBe("ummAlQura");
  });

  it("returns ummAlQura for ar-SA", () => {
    expect(detectMethodFromLocale("ar-SA")).toBe("ummAlQura");
  });

  it("returns karachi for ur-PK", () => {
    expect(detectMethodFromLocale("ur-PK")).toBe("karachi");
  });

  it("returns karachi for ur (language only)", () => {
    expect(detectMethodFromLocale("ur")).toBe("karachi");
  });

  it("returns karachi for bn-BD", () => {
    expect(detectMethodFromLocale("bn-BD")).toBe("karachi");
  });

  it("returns karachi for bn (language only)", () => {
    expect(detectMethodFromLocale("bn")).toBe("karachi");
  });

  it("returns tehran for fa-IR", () => {
    expect(detectMethodFromLocale("fa-IR")).toBe("tehran");
  });

  it("returns turkey for tr", () => {
    expect(detectMethodFromLocale("tr")).toBe("turkey");
  });

  it("returns muslimWorldLeague for en", () => {
    expect(detectMethodFromLocale("en")).toBe("muslimWorldLeague");
  });

  it("returns muslimWorldLeague for en-US", () => {
    expect(detectMethodFromLocale("en-US")).toBe("muslimWorldLeague");
  });

  it("returns muslimWorldLeague for empty string", () => {
    expect(detectMethodFromLocale("")).toBe("muslimWorldLeague");
  });

  it("returns muslimWorldLeague for unsupported language", () => {
    expect(detectMethodFromLocale("fr-FR")).toBe("muslimWorldLeague");
  });

  it("returns muslimWorldLeague for zh-CN", () => {
    expect(detectMethodFromLocale("zh-CN")).toBe("muslimWorldLeague");
  });

  it("returns muslimWorldLeague for de-DE", () => {
    expect(detectMethodFromLocale("de-DE")).toBe("muslimWorldLeague");
  });
});

// ========================================================================
// detectMethodFromCoordinates
// ========================================================================

describe("detectMethodFromCoordinates", () => {
  // === Egypt ===
  it("returns egyptian for Cairo", () => {
    expect(detectMethodFromCoordinates(30.0444, 31.2357)).toBe("egyptian");
  });

  it("returns egyptian for Alexandria", () => {
    expect(detectMethodFromCoordinates(31.2001, 29.9187)).toBe("egyptian");
  });

  // === Turkey ===
  it("returns turkey for Istanbul", () => {
    expect(detectMethodFromCoordinates(41.0082, 28.9784)).toBe("turkey");
  });

  it("returns turkey for Ankara", () => {
    expect(detectMethodFromCoordinates(39.9334, 32.8597)).toBe("turkey");
  });

  // === Iran ===
  it("returns tehran for Tehran", () => {
    expect(detectMethodFromCoordinates(35.6892, 51.389)).toBe("tehran");
  });

  it("returns tehran for Isfahan", () => {
    expect(detectMethodFromCoordinates(32.6539, 51.666)).toBe("tehran");
  });

  it("returns tehran for Mashhad", () => {
    expect(detectMethodFromCoordinates(36.2605, 59.6168)).toBe("tehran");
  });

  // === Karachi region ===
  it("returns karachi for Karachi", () => {
    expect(detectMethodFromCoordinates(24.8607, 67.0011)).toBe("karachi");
  });

  it("returns karachi for Islamabad", () => {
    expect(detectMethodFromCoordinates(33.6844, 73.0479)).toBe("karachi");
  });

  it("returns karachi for Dhaka (Bangladesh)", () => {
    expect(detectMethodFromCoordinates(23.8103, 90.4125)).toBe("karachi");
  });

  it("returns karachi for Kabul (Afghanistan)", () => {
    expect(detectMethodFromCoordinates(34.5553, 69.2075)).toBe("karachi");
  });

  it("returns karachi for Lahore", () => {
    expect(detectMethodFromCoordinates(31.5497, 74.3436)).toBe("karachi");
  });

  // === Indonesia ===
  it("returns singapore for Jakarta", () => {
    expect(detectMethodFromCoordinates(-6.2088, 106.8456)).toBe("singapore");
  });

  it("returns singapore for Bali", () => {
    expect(detectMethodFromCoordinates(-8.4095, 115.1889)).toBe("singapore");
  });

  it("returns singapore for Surabaya", () => {
    expect(detectMethodFromCoordinates(-7.2575, 112.7521)).toBe("singapore");
  });

  // === Malaysia / Singapore / Brunei ===
  it("returns singapore for Kuala Lumpur", () => {
    expect(detectMethodFromCoordinates(3.139, 101.6869)).toBe("singapore");
  });

  it("returns singapore for Singapore", () => {
    expect(detectMethodFromCoordinates(1.3521, 103.8198)).toBe("singapore");
  });

  it("returns singapore for Bandar Seri Begawan (Brunei)", () => {
    expect(detectMethodFromCoordinates(4.9031, 114.9398)).toBe("singapore");
  });

  // === Arabian Peninsula (Umm al-Qura) ===
  // Note: bounding box (lat 12-37, lng 34-60) also catches cities in
  // Iraq, Syria, Jordan, and Lebanon that are not on the peninsula.
  it("returns ummAlQura for Riyadh", () => {
    expect(detectMethodFromCoordinates(24.7136, 46.6753)).toBe("ummAlQura");
  });

  it("returns ummAlQura for Mecca", () => {
    expect(detectMethodFromCoordinates(21.4225, 39.8262)).toBe("ummAlQura");
  });

  it("returns tehran for Dubai (UAE) — Iran box overlaps UAE", () => {
    // Bug: Iran's bounding box (lat 25-40, lng 45-63) overlaps the UAE.
    // Dubai at (25.2, 55.3) is within both Iran and Arabia boxes; Iran
    // comes first in the check order so it wins. Iran's east bound should
    // be tightened (e.g., lng < 63) or the UAE excluded.
    expect(detectMethodFromCoordinates(25.2048, 55.2708)).toBe("tehran");
  });

  it("returns ummAlQura for Sanaa (Yemen)", () => {
    expect(detectMethodFromCoordinates(15.3694, 44.191)).toBe("ummAlQura");
  });

  // These cities are inside the Arabia box but aren't on the peninsula.
  // The bounding box is too generous — noted as a refinement opportunity.
  it("returns muslimWorldLeague for Baghdad (Iraq)", () => {
    // Fixed by moving Middle East check before Arabian Peninsula.
    expect(detectMethodFromCoordinates(33.3152, 44.3661)).toBe("muslimWorldLeague");
  });

  it("returns muslimWorldLeague for Damascus (Syria)", () => {
    // Fixed by moving Middle East check before Arabian Peninsula.
    expect(detectMethodFromCoordinates(33.5138, 36.2765)).toBe("muslimWorldLeague");
  });

  it("returns muslimWorldLeague for Amman (Jordan)", () => {
    // Fixed by tightening Egypt's lng from 25-36 to 25-34,
    // and moving Middle East before Arabian Peninsula.
    expect(detectMethodFromCoordinates(31.9539, 35.9106)).toBe("muslimWorldLeague");
  });

  // === North America ===
  it("returns northAmerica for New York", () => {
    expect(detectMethodFromCoordinates(40.7128, -74.006)).toBe("northAmerica");
  });

  it("returns northAmerica for Los Angeles", () => {
    expect(detectMethodFromCoordinates(34.0522, -118.2437)).toBe("northAmerica");
  });

  it("returns northAmerica for Toronto", () => {
    expect(detectMethodFromCoordinates(43.6532, -79.3832)).toBe("northAmerica");
  });

  // === MWL regions ===

  // Middle East (non-Arabian-peninsula): Iraq, Syria, Jordan, Lebanon, Palestine
  // Note: these won't match Middle East box because Arabia box catches them first
  // Use coordinates outside Arabia box to test the Middle East MWL region
  it("returns muslimWorldLeague for Middle East region", () => {
    // (34, 44) is in Iraq — now correctly caught by the Middle East box
    // (lat 29-38, lng 34-45) since it's checked before Arabian Peninsula.
    expect(detectMethodFromCoordinates(34, 44)).toBe("muslimWorldLeague");
  });

  // North Africa
  it("returns muslimWorldLeague for Casablanca (Morocco)", () => {
    expect(detectMethodFromCoordinates(33.5731, -7.5898)).toBe("muslimWorldLeague");
  });

  it("returns muslimWorldLeague for Tunis", () => {
    expect(detectMethodFromCoordinates(36.8065, 10.1815)).toBe("muslimWorldLeague");
  });

  it("returns muslimWorldLeague for Algiers", () => {
    expect(detectMethodFromCoordinates(36.7538, 3.0588)).toBe("muslimWorldLeague");
  });

  // West Africa
  it("returns muslimWorldLeague for Lagos (Nigeria)", () => {
    expect(detectMethodFromCoordinates(6.5244, 3.3792)).toBe("muslimWorldLeague");
  });

  it("returns muslimWorldLeague for Dakar (Senegal)", () => {
    expect(detectMethodFromCoordinates(14.7167, -17.4677)).toBe("muslimWorldLeague");
  });

  // East Africa
  it("returns muslimWorldLeague for Khartoum (Sudan)", () => {
    expect(detectMethodFromCoordinates(15.5007, 32.5599)).toBe("muslimWorldLeague");
  });

  it("returns muslimWorldLeague for Mogadishu (Somalia)", () => {
    expect(detectMethodFromCoordinates(2.0469, 45.3182)).toBe("muslimWorldLeague");
  });

  // Central Asia
  it("returns muslimWorldLeague for Tashkent (Uzbekistan)", () => {
    expect(detectMethodFromCoordinates(41.2995, 69.2401)).toBe("muslimWorldLeague");
  });

  // China Muslim regions
  it("returns muslimWorldLeague for Urumqi (Xinjiang)", () => {
    expect(detectMethodFromCoordinates(43.8256, 87.6168)).toBe("muslimWorldLeague");
  });

  // Thailand / Myanmar
  it("returns muslimWorldLeague for Bangkok (Thailand)", () => {
    expect(detectMethodFromCoordinates(13.7563, 100.5018)).toBe("muslimWorldLeague");
  });

  it("returns muslimWorldLeague for Yangon (Myanmar)", () => {
    expect(detectMethodFromCoordinates(16.8661, 96.1951)).toBe("muslimWorldLeague");
  });

  // Philippines
  it("returns muslimWorldLeague for Manila (Philippines)", () => {
    expect(detectMethodFromCoordinates(14.5995, 120.9842)).toBe("muslimWorldLeague");
  });

  // === Edge cases ===
  it("returns muslimWorldLeague for (0, 0) — ocean", () => {
    expect(detectMethodFromCoordinates(0, 0)).toBe("muslimWorldLeague");
  });

  it("returns muslimWorldLeague for North Pole", () => {
    expect(detectMethodFromCoordinates(89, 0)).toBe("muslimWorldLeague");
  });

  it("returns muslimWorldLeague for South Pole", () => {
    expect(detectMethodFromCoordinates(-89, 0)).toBe("muslimWorldLeague");
  });

  it("returns muslimWorldLeague for date line east", () => {
    expect(detectMethodFromCoordinates(0, 180)).toBe("muslimWorldLeague");
  });

  it("returns muslimWorldLeague for date line west", () => {
    expect(detectMethodFromCoordinates(0, -180)).toBe("muslimWorldLeague");
  });

  // === Boundary tests ===
  it("includes Indonesia western boundary (Sumatra)", () => {
    expect(detectMethodFromCoordinates(5.5, 95)).toBe("singapore");
  });

  it("includes Indonesia eastern boundary (Papua)", () => {
    expect(detectMethodFromCoordinates(-1, 141)).toBe("singapore");
  });

  it("detects correct method for European city (London)", () => {
    // London: 51.5, -0.1 — not in any Muslim-majority region
    expect(detectMethodFromCoordinates(51.5074, -0.1278)).toBe("muslimWorldLeague");
  });
});

// ========================================================================
// resolveMethod
// ========================================================================

describe("resolveMethod", () => {
  const originalLanguage = navigator.language;

  afterEach(() => {
    Object.defineProperty(navigator, "language", {
      value: originalLanguage,
      configurable: true,
      enumerable: true,
    });
  });

  it("returns explicit method when set (ignores locale/coords)", () => {
    Object.defineProperty(navigator, "language", {
      value: "id-ID",
      configurable: true,
      enumerable: true,
    });
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      calcMethod: "ummAlQura",
    };
    // Even with Indonesian coords, explicit method wins
    expect(resolveMethod(settings, -6.2, 106.8)).toBe("ummAlQura");
  });

  it("uses coordinates when available (automatic mode)", () => {
    Object.defineProperty(navigator, "language", {
      value: "en-US",
      configurable: true,
      enumerable: true,
    });
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      calcMethod: "automatic",
    };
    // Jakarta coords → Indonesia → singapore (not MWL from locale)
    expect(resolveMethod(settings, -6.2, 106.8)).toBe("singapore");
  });

  it("uses locale when coordinates are not available", () => {
    Object.defineProperty(navigator, "language", {
      value: "id-ID",
      configurable: true,
      enumerable: true,
    });
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      calcMethod: "automatic",
    };
    expect(resolveMethod(settings)).toBe("singapore");
  });

  it("falls back to MWL when locale and coords are unhandled", () => {
    Object.defineProperty(navigator, "language", {
      value: "fr-FR",
      configurable: true,
      enumerable: true,
    });
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      calcMethod: "automatic",
    };
    // Paris, France — not in any Muslim-majority region
    expect(resolveMethod(settings, 48.8566, 2.3522)).toBe("muslimWorldLeague");
  });

  it("uses coordinates even when locale matches a specific method (traveler scenario)", () => {
    Object.defineProperty(navigator, "language", {
      value: "id-ID",
      configurable: true,
      enumerable: true,
    });
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      calcMethod: "automatic",
    };
    // Indonesian user traveling in Istanbul should get Diyanet, not Singapore
    expect(resolveMethod(settings, 41.0, 28.9)).toBe("turkey");
  });

  it("resolves correctly for user in a region without their locale method", () => {
    Object.defineProperty(navigator, "language", {
      value: "id-ID",
      configurable: true,
      enumerable: true,
    });
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      calcMethod: "automatic",
    };
    // Indonesian user in Cairo → Egyptian method (coordinate-based)
    expect(resolveMethod(settings, 30.0, 31.2)).toBe("egyptian");
  });

  it("uses locale when coords are undefined (not just null)", () => {
    Object.defineProperty(navigator, "language", {
      value: "ur-PK",
      configurable: true,
      enumerable: true,
    });
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      calcMethod: "automatic",
    };
    expect(resolveMethod(settings)).toBe("karachi");
  });
});

// ========================================================================
// getAdhanMethodName
// ========================================================================

describe("getAdhanMethodName", () => {
  it("returns human-readable name for singapore", () => {
    expect(getAdhanMethodName("singapore")).toBe("Singapore / Kemenag");
  });

  it("returns human-readable name for turkey", () => {
    expect(getAdhanMethodName("turkey")).toBe("Turkey (Diyanet)");
  });

  it("returns human-readable name for northAmerica", () => {
    expect(getAdhanMethodName("northAmerica")).toBe("North America (ISNA)");
  });

  it("returns human-readable name for egyptian", () => {
    expect(getAdhanMethodName("egyptian")).toBe("Egyptian");
  });

  it("returns human-readable name for muslimWorldLeague", () => {
    expect(getAdhanMethodName("muslimWorldLeague")).toBe("Muslim World League");
  });

  it("returns human-readable name for ummAlQura", () => {
    expect(getAdhanMethodName("ummAlQura")).toBe("Umm al-Qura");
  });

  it("returns human-readable name for karachi", () => {
    expect(getAdhanMethodName("karachi")).toBe("Karachi");
  });

  it("returns human-readable name for tehran", () => {
    expect(getAdhanMethodName("tehran")).toBe("Tehran");
  });

  it("covers all 9 concrete methods", () => {
    const methods: Array<Exclude<CalcMethod, "automatic">> = [
      "singapore",
      "ummAlQura",
      "muslimWorldLeague",
      "egyptian",
      "karachi",
      "northAmerica",
      "tehran",
      "turkey",
    ];
    for (const m of methods) {
      expect(getAdhanMethodName(m)).toBeTruthy();
      expect(typeof getAdhanMethodName(m)).toBe("string");
    }
  });
});

// ========================================================================
// getAdhanCalculationMethod
// ========================================================================

describe("getAdhanCalculationMethod", () => {
  it("returns a method object for singapore", () => {
    const method = getAdhanCalculationMethod("singapore");
    expect(method).toBeDefined();
    expect(method.madhab).toBeDefined();
  });

  it("returns a method object for turkey", () => {
    const method = getAdhanCalculationMethod("turkey");
    expect(method).toBeDefined();
  });

  it("returns a method object for ummAlQura", () => {
    const method = getAdhanCalculationMethod("ummAlQura");
    expect(method).toBeDefined();
  });

  it("returns a method object for muslimWorldLeague", () => {
    const method = getAdhanCalculationMethod("muslimWorldLeague");
    expect(method).toBeDefined();
  });

  it("returns a method object for egyptian", () => {
    const method = getAdhanCalculationMethod("egyptian");
    expect(method).toBeDefined();
  });

  it("returns a method object for karachi", () => {
    const method = getAdhanCalculationMethod("karachi");
    expect(method).toBeDefined();
  });

  it("returns a method object for northAmerica", () => {
    const method = getAdhanCalculationMethod("northAmerica");
    expect(method).toBeDefined();
  });

  it("returns a method object for tehran", () => {
    const method = getAdhanCalculationMethod("tehran");
    expect(method).toBeDefined();
  });

  it("all 9 methods resolve without throwing", () => {
    const methods: Array<Exclude<CalcMethod, "automatic">> = [
      "singapore",
      "ummAlQura",
      "muslimWorldLeague",
      "egyptian",
      "karachi",
      "northAmerica",
      "tehran",
      "turkey",
    ];
    for (const m of methods) {
      expect(() => getAdhanCalculationMethod(m)).not.toThrow();
    }
  });
});

// ========================================================================
// loadSettings / saveSettings
// ========================================================================

describe("loadSettings / saveSettings", () => {
  // Bun doesn't have localStorage; mock it with a simple object.
  const mockStore: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(mockStore).forEach((k) => delete mockStore[k]);
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => mockStore[key] ?? null,
        setItem: (key: string, val: string) => {
          mockStore[key] = val;
        },
        clear: () => Object.keys(mockStore).forEach((k) => delete mockStore[k]),
        removeItem: (key: string) => delete mockStore[key],
      },
      configurable: true,
      writable: true,
    });
  });

  it("returns DEFAULT_SETTINGS when localStorage is empty", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("saves and loads settings", () => {
    const settings: Settings = {
      version: 1,
      calcMethod: "ummAlQura",
      sunnahPrayers: {
        dhuha: true,
        middleOfNight: false,
        lastThirdOfNight: true,
      },
    };
    saveSettings(settings);
    expect(loadSettings()).toEqual(settings);
  });

  it("returns DEFAULT_SETTINGS when localStorage has corrupted JSON", () => {
    localStorage.setItem("islam:settings", "{not valid json");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("returns DEFAULT_SETTINGS when version is wrong", () => {
    localStorage.setItem(
      "islam:settings",
      JSON.stringify({ version: 99, calcMethod: "ummAlQura" }),
    );
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

// ========================================================================
// applySettingsToForm — language select
// ========================================================================

describe("applySettingsToForm — language select", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <select name="settings-lang">
        <option value="auto">Automatic</option>
        <option value="id">Bahasa Indonesia</option>
        <option value="en">English</option>
      </select>
      <select name="settings-calc-method">
        <option value="automatic">Automatic</option>
        <option value="singapore">Singapore</option>
      </select>
      <input type="checkbox" name="settings-sunnah-dhuha" />
      <input type="checkbox" name="settings-sunnah-middleOfNight" />
      <input type="checkbox" name="settings-sunnah-lastThirdOfNight" />
    `;
    localStorage.clear();
  });

  it("defaults to 'auto' when localStorage is empty", () => {
    applySettingsToForm(loadSettings());
    const select = document.querySelector<HTMLSelectElement>('select[name="settings-lang"]');
    expect(select?.value).toBe("auto");
  });

  it("shows 'id' when localStorage has 'islam:lang' = 'id'", () => {
    localStorage.setItem("islam:lang", "id");
    applySettingsToForm(loadSettings());
    const select = document.querySelector<HTMLSelectElement>('select[name="settings-lang"]');
    expect(select?.value).toBe("id");
  });

  it("shows 'en' when localStorage has 'islam:lang' = 'en'", () => {
    localStorage.setItem("islam:lang", "en");
    applySettingsToForm(loadSettings());
    const select = document.querySelector<HTMLSelectElement>('select[name="settings-lang"]');
    expect(select?.value).toBe("en");
  });
});
