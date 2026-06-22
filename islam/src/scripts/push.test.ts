import { describe, it, expect, vi, beforeAll, afterEach, beforeEach } from "vitest";
import { setLocale } from "../i18n/i18n";

// ---------------------------------------------------------------------------
// Use vi.hoisted so the mocks are set up before the module imports below
// ---------------------------------------------------------------------------
const {
  mockRequestPermission,
  mockSubscribe,
  mockUnsubscribe,
  mockGetSubscription,
  mockFetch,
  mockRegistration,
} = vi.hoisted(() => {
  const mockRequestPermission = vi.fn();
  const mockSubscribe = vi.fn();
  const mockUnsubscribe = vi.fn();
  const mockGetSubscription = vi.fn();
  const mockFetch = vi.fn();
  const mockRegistration = {
    pushManager: {
      subscribe: mockSubscribe,
      getSubscription: mockGetSubscription,
    },
  };
  return {
    mockRequestPermission,
    mockSubscribe,
    mockUnsubscribe,
    mockGetSubscription,
    mockFetch,
    mockRegistration,
  };
});

// Mock the location module
vi.mock("../lib/location", () => ({
  getUserLocation: () => ({ lat: -6.2, lng: 106.8 }),
  markServerSynced: vi.fn(),
}));

// Mock the settings module so push.ts can resolve calcMethod
vi.mock("../lib/settings", () => ({
  loadSettings: () => ({
    version: 1 as const,
    calcMethod: "singapore",
    sunnahPrayers: { dhuha: false, middleOfNight: false, lastThirdOfNight: false },
  }),
  resolveMethod: () => "singapore",
}));

// Set up browser globals
beforeAll(() => {
  // Replace navigator entirely so push.ts sees a clean mock
  Object.defineProperty(globalThis, "navigator", {
    value: {
      serviceWorker: {
        ready: Promise.resolve(mockRegistration),
      },
    },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, "navigator", {
    value: {
      serviceWorker: {
        ready: Promise.resolve(mockRegistration),
      },
    },
    configurable: true,
    writable: true,
  });
  // PushManager is checked in enableNotifications: "PushManager" in window
  Object.defineProperty(window, "PushManager", {
    value: function () {},
    configurable: true,
    writable: true,
  });
  globalThis.Notification = {
    requestPermission: mockRequestPermission,
  } as unknown as typeof Notification;
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

// Reset locale before each test so locale-dependent tests start clean
beforeEach(() => {
  setLocale("en");
});

import {
  enableNotifications,
  disableNotifications,
  updatePreferences,
  getPushSubscription,
  syncServerState,
  type PushPrefs,
} from "./push";

const FAKE_SUBSCRIPTION_JSON = {
  endpoint: "https://web.push.apple.com/QJptHgdBpmx_82iV1UxbjO4PvlItdEA1XiooAqaUEkSUAwD4gSvYK-SNNf9GKXimiRkVwTLUb7ThdhSUDuK-pYpWKAGgrREoCro13r7IyNutI2d3mQcR2lhyCIIVv3ZlOsaK731gnHmQsx3xEJHKW1c4AkhWhnDr-IVjREJidRg",
  keys: {
    p256dh: "BEbSsHPhD5Bk7DKHOF_WtJgOHP-NuKT2CC9guuAlW_1nHlOLVjFSq2iAKLW0BXJYHZg3Q90gha1w6neTdAHOEGE",
    auth: "OPJIsVWTwTee-r4ViwTAzQ",
  },
  expirationTime: null,
};

const PREFS: PushPrefs = {
  fajr: true,
  dhuhr: true,
  asr: true,
  maghrib: true,
  isha: true,
};

describe("enableNotifications", () => {
  afterEach(() => {
    mockRequestPermission.mockReset();
    mockSubscribe.mockReset();
    mockUnsubscribe.mockReset();
    mockFetch.mockReset();
    localStorage.clear();
  });

  it("sends flat fields to worker (endpoint, keys at top level)", async () => {
    mockRequestPermission.mockResolvedValue("granted");
    mockSubscribe.mockResolvedValue({
      toJSON: () => FAKE_SUBSCRIPTION_JSON,
      unsubscribe: mockUnsubscribe,
    });
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await enableNotifications(PREFS);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/subscribe");

    const body = JSON.parse(options.body);
    expect(body).toHaveProperty("endpoint", FAKE_SUBSCRIPTION_JSON.endpoint);
    expect(body).toHaveProperty("keys");
    expect(body.keys).toEqual(FAKE_SUBSCRIPTION_JSON.keys);
    expect(body).not.toHaveProperty("subscription");
    expect(body).toHaveProperty("timezone");
    expect(body).toHaveProperty("prefs", PREFS);
    expect(body).toHaveProperty("lat", -6.2);
    expect(body).toHaveProperty("lng", 106.8);
    expect(body).toHaveProperty("calcMethod", "singapore");
  });

  it("stores subscribed state in localStorage on success", async () => {
    mockRequestPermission.mockResolvedValue("granted");
    mockSubscribe.mockResolvedValue({
      toJSON: () => FAKE_SUBSCRIPTION_JSON,
      unsubscribe: mockUnsubscribe,
    });
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await enableNotifications(PREFS);
    expect(localStorage.getItem("islam:push:subscribed")).toBe("true");
    expect(localStorage.getItem("islam:push:prefs")).toBe(JSON.stringify(PREFS));
  });

  it("does not subscribe when permission is denied", async () => {
    mockRequestPermission.mockResolvedValue("denied");

    await enableNotifications(PREFS);
    expect(mockSubscribe).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("re-throws AbortError from pushManager.subscribe after logging", async () => {
    mockRequestPermission.mockResolvedValue("granted");
    const abortError = new DOMException("Registration failed - push service error", "AbortError");
    mockSubscribe.mockRejectedValue(abortError);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(enableNotifications(PREFS)).rejects.toThrow(abortError);
    expect(consoleSpy).toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("re-throws NotAllowedError from pushManager.subscribe after logging", async () => {
    mockRequestPermission.mockResolvedValue("granted");
    const notAllowedError = new DOMException("Permission denied", "NotAllowedError");
    mockSubscribe.mockRejectedValue(notAllowedError);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(enableNotifications(PREFS)).rejects.toThrow(notAllowedError);
    expect(consoleSpy).toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("re-throws generic error from pushManager.subscribe after logging", async () => {
    mockRequestPermission.mockResolvedValue("granted");
    const genericError = new Error("Something went wrong");
    mockSubscribe.mockRejectedValue(genericError);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(enableNotifications(PREFS)).rejects.toThrow(genericError);
    expect(consoleSpy).toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("sends locale:'en' in the body by default", async () => {
    setLocale("en");
    mockRequestPermission.mockResolvedValue("granted");
    mockSubscribe.mockResolvedValue({
      toJSON: () => FAKE_SUBSCRIPTION_JSON,
      unsubscribe: mockUnsubscribe,
    });
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await enableNotifications(PREFS);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toHaveProperty("locale", "en");
  });

  it("sends locale:'id' in the body when PWA locale is 'id'", async () => {
    setLocale("id");
    mockRequestPermission.mockResolvedValue("granted");
    mockSubscribe.mockResolvedValue({
      toJSON: () => FAKE_SUBSCRIPTION_JSON,
      unsubscribe: mockUnsubscribe,
    });
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await enableNotifications(PREFS);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toHaveProperty("locale", "id");
  });
});

describe("disableNotifications", () => {
  afterEach(() => {
    mockGetSubscription.mockReset();
    mockUnsubscribe.mockReset();
    mockFetch.mockReset();
    localStorage.clear();
  });

  it("sends flat endpoint to worker (not nested under subscription)", async () => {
    mockGetSubscription.mockResolvedValue({
      toJSON: () => FAKE_SUBSCRIPTION_JSON,
      unsubscribe: mockUnsubscribe.mockResolvedValue(true),
    });
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    localStorage.setItem("islam:push:subscribed", "true");

    await disableNotifications();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/unsubscribe");

    const body = JSON.parse(options.body);
    expect(body).toHaveProperty("endpoint", FAKE_SUBSCRIPTION_JSON.endpoint);
    expect(body).not.toHaveProperty("subscription");
  });
});

describe("updatePreferences", () => {
  afterEach(() => {
    mockGetSubscription.mockReset();
    mockFetch.mockReset();
    localStorage.clear();
  });

  it("sends flat fields to worker (endpoint, keys at top level)", async () => {
    mockGetSubscription.mockResolvedValue({
      toJSON: () => FAKE_SUBSCRIPTION_JSON,
    });
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    localStorage.setItem("islam:push:subscribed", "true");

    await updatePreferences(PREFS);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/preferences");

    const body = JSON.parse(options.body);
    expect(body).toHaveProperty("endpoint", FAKE_SUBSCRIPTION_JSON.endpoint);
    expect(body).toHaveProperty("keys");
    expect(body.keys).toEqual(FAKE_SUBSCRIPTION_JSON.keys);
    expect(body).toHaveProperty("prefs", PREFS);
    expect(body).toHaveProperty("calcMethod", "singapore");
    expect(body).not.toHaveProperty("subscription");
  });

  it("does nothing if not subscribed", async () => {
    await updatePreferences(PREFS);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sends locale:'id' in the body when PWA locale is 'id'", async () => {
    setLocale("id");
    mockGetSubscription.mockResolvedValue({
      toJSON: () => FAKE_SUBSCRIPTION_JSON,
    });
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    localStorage.setItem("islam:push:subscribed", "true");

    await updatePreferences(PREFS);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toHaveProperty("locale", "id");
  });
});

describe("syncServerState", () => {
  afterEach(() => {
    mockGetSubscription.mockReset();
    mockFetch.mockReset();
    localStorage.clear();
  });

  it("sends calcMethod in the body to /api/subscribe", async () => {
    mockGetSubscription.mockResolvedValue({
      toJSON: () => FAKE_SUBSCRIPTION_JSON,
    });
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await syncServerState(PREFS);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/subscribe");

    const body = JSON.parse(options.body);
    expect(body).toHaveProperty("calcMethod", "singapore");
    expect(body).toHaveProperty("endpoint", FAKE_SUBSCRIPTION_JSON.endpoint);
    expect(body).toHaveProperty("lat", -6.2);
    expect(body).toHaveProperty("lng", 106.8);
    expect(body).toHaveProperty("prefs", PREFS);
    expect(body).toHaveProperty("locale", "en");
  });

  it("does nothing if not subscribed", async () => {
    mockGetSubscription.mockResolvedValue(null);

    await syncServerState(PREFS);

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("enableNotifications (idempotent re-subscribe)", () => {
  afterEach(() => {
    mockRequestPermission.mockReset();
    mockSubscribe.mockReset();
    mockFetch.mockReset();
    localStorage.clear();
  });

  it("can be called multiple times to update prefs (e.g., from checkbox toggle)", async () => {
    mockRequestPermission.mockResolvedValue("granted");
    // PushManager.subscribe() returns the existing subscription if one exists
    mockSubscribe.mockResolvedValue({
      toJSON: () => FAKE_SUBSCRIPTION_JSON,
    });
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    // First call — user clicks "Enable Notifications"
    await enableNotifications(PREFS);

    // Second call — user toggles off Asr
    const updatedPrefs: PushPrefs = { ...PREFS, asr: false };
    await enableNotifications(updatedPrefs);

    expect(mockFetch).toHaveBeenCalledTimes(2);

    // The second call should include the updated prefs (asr: false)
    const secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(secondCallBody.prefs).toEqual(updatedPrefs);
    expect(secondCallBody.prefs.asr).toBe(false);
  });
});

describe("getPushSubscription", () => {
  afterEach(() => {
    mockGetSubscription.mockReset();
  });

  it("returns the current subscription when subscribed", async () => {
    mockGetSubscription.mockResolvedValue({
      endpoint: FAKE_SUBSCRIPTION_JSON.endpoint,
      keys: FAKE_SUBSCRIPTION_JSON.keys,
      expirationTime: null,
    });

    const sub = await getPushSubscription();

    expect(sub).not.toBeNull();
    expect(sub?.endpoint).toBe(FAKE_SUBSCRIPTION_JSON.endpoint);
    expect(sub?.keys).toEqual(FAKE_SUBSCRIPTION_JSON.keys);
  });

  it("returns null when not subscribed", async () => {
    mockGetSubscription.mockResolvedValue(null);

    const sub = await getPushSubscription();
    expect(sub).toBeNull();
  });
});
