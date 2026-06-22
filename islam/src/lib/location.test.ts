import { describe, it, expect, beforeEach } from "vitest";
import {
  setUserLocation,
  getUserLocation,
  clearUserLocation,
  loadCachedLocation,
  isLocationFromCache,
  hasLocationDrift,
  isLocationStale,
  markServerSynced,
} from "./location";

describe("location", () => {
  beforeEach(() => {
    clearUserLocation();
    localStorage.removeItem("islam:location");
  });

  describe("getUserLocation", () => {
    it("returns null when no location is set", () => {
      expect(getUserLocation()).toBe(null);
    });

    it("returns null after clear", () => {
      setUserLocation(-6.2, 106.8);
      clearUserLocation();
      expect(getUserLocation()).toBe(null);
    });
  });

  describe("setUserLocation", () => {
    it("stores coordinates", () => {
      setUserLocation(-6.2, 106.8);
      expect(getUserLocation()).toEqual({ lat: -6.2, lng: 106.8 });
    });

    it("overwrites previous coordinates", () => {
      setUserLocation(-6.2, 106.8);
      setUserLocation(40.7, -74.0);
      expect(getUserLocation()).toEqual({ lat: 40.7, lng: -74.0 });
    });

    it("handles negative coordinates (southern/western hemispheres)", () => {
      setUserLocation(-33.9, 151.2); // Sydney
      expect(getUserLocation()).toEqual({ lat: -33.9, lng: 151.2 });
    });

    it("handles coordinates at equator/prime meridian", () => {
      setUserLocation(0, 0);
      expect(getUserLocation()).toEqual({ lat: 0, lng: 0 });
    });

    it("persists to localStorage", () => {
      setUserLocation(-6.2, 106.8);
      const raw = localStorage.getItem("islam:location");
      expect(raw).not.toBeNull();
      const data = JSON.parse(raw!);
      expect(data).toHaveProperty("lat", -6.2);
      expect(data).toHaveProperty("lng", 106.8);
      expect(data).toHaveProperty("timestamp");
      expect(typeof data.timestamp).toBe("number");
    });
  });

  describe("loadCachedLocation", () => {
    it("returns true and hydrates memory when valid cached data exists", () => {
      localStorage.setItem(
        "islam:location",
        JSON.stringify({ lat: -6.2, lng: 106.8, timestamp: Date.now() }),
      );
      const result = loadCachedLocation();
      expect(result).toBe(true);
      expect(getUserLocation()).toEqual({ lat: -6.2, lng: 106.8 });
    });

    it("returns false when no cached data", () => {
      expect(loadCachedLocation()).toBe(false);
    });

    it("returns false when cached data is malformed (invalid JSON)", () => {
      localStorage.setItem("islam:location", "{not valid json");
      expect(loadCachedLocation()).toBe(false);
    });

    it("returns false when cached data is not an object", () => {
      localStorage.setItem("islam:location", '"string"');
      expect(loadCachedLocation()).toBe(false);
    });

    it("returns false when lat is missing", () => {
      localStorage.setItem(
        "islam:location",
        JSON.stringify({ lng: 106.8, timestamp: Date.now() }),
      );
      expect(loadCachedLocation()).toBe(false);
    });

    it("returns false when lng is missing", () => {
      localStorage.setItem(
        "islam:location",
        JSON.stringify({ lat: -6.2, timestamp: Date.now() }),
      );
      expect(loadCachedLocation()).toBe(false);
    });

    it("returns false when lat is not a number", () => {
      localStorage.setItem(
        "islam:location",
        JSON.stringify({ lat: "not-a-number", lng: 106.8, timestamp: Date.now() }),
      );
      expect(loadCachedLocation()).toBe(false);
    });

    it("returns false when localStorage is unavailable", () => {
      const original = globalThis.localStorage;
      // @ts-expect-error — removing localStorage to simulate SSR / unavailable
      delete globalThis.localStorage;
      try {
        expect(loadCachedLocation()).toBe(false);
      } finally {
        globalThis.localStorage = original;
      }
    });
  });

  describe("clearUserLocation", () => {
    it("removes from both memory and localStorage", () => {
      setUserLocation(-6.2, 106.8);
      expect(localStorage.getItem("islam:location")).not.toBeNull();
      clearUserLocation();
      expect(getUserLocation()).toBeNull();
      expect(localStorage.getItem("islam:location")).toBeNull();
    });
  });

  describe("getUserLocation after loadCachedLocation", () => {
    it("returns cached value after loadCachedLocation", () => {
      localStorage.setItem(
        "islam:location",
        JSON.stringify({ lat: -6.2, lng: 106.8, timestamp: Date.now() }),
      );
      loadCachedLocation();
      expect(getUserLocation()).toEqual({ lat: -6.2, lng: 106.8 });
    });
  });

  describe("isLocationFromCache", () => {
    it("returns false initially", () => {
      expect(isLocationFromCache()).toBe(false);
    });

    it("returns true after loadCachedLocation succeeds", () => {
      localStorage.setItem(
        "islam:location",
        JSON.stringify({ lat: -6.2, lng: 106.8, timestamp: Date.now() }),
      );
      loadCachedLocation();
      expect(isLocationFromCache()).toBe(true);
    });

    it("returns false after setUserLocation(lat, lng, false) (fresh GPS)", () => {
      // First set from cache
      localStorage.setItem(
        "islam:location",
        JSON.stringify({ lat: -6.2, lng: 106.8, timestamp: Date.now() }),
      );
      loadCachedLocation();
      expect(isLocationFromCache()).toBe(true);

      // Now fresh GPS arrives
      setUserLocation(40.7, -74.0, false);
      expect(isLocationFromCache()).toBe(false);
    });

    it("returns true after setUserLocation(lat, lng, true) (explicit fromCache)", () => {
      setUserLocation(-6.2, 106.8, true);
      expect(isLocationFromCache()).toBe(true);
    });

    it("returns false after clearUserLocation", () => {
      setUserLocation(-6.2, 106.8, true);
      expect(isLocationFromCache()).toBe(true);
      clearUserLocation();
      expect(isLocationFromCache()).toBe(false);
    });
  });

  describe("hasLocationDrift", () => {
    it("returns true when no position is set", () => {
      expect(hasLocationDrift(-6.2, 106.8)).toBe(true);
    });

    it("returns false when position is within threshold", () => {
      setUserLocation(-6.2, 106.8);
      // ~5 km south — within 0.1 degree threshold
      expect(hasLocationDrift(-6.15, 106.8)).toBe(false);
      // ~5 km east
      expect(hasLocationDrift(-6.2, 106.85)).toBe(false);
    });

    it("returns true when lat drifts beyond threshold", () => {
      setUserLocation(-6.2, 106.8);
      // ~15 km south — beyond 0.1 degree
      expect(hasLocationDrift(-6.35, 106.8)).toBe(true);
    });

    it("returns true when lng drifts beyond threshold", () => {
      setUserLocation(-6.2, 106.8);
      // ~15 km east
      expect(hasLocationDrift(-6.2, 106.95)).toBe(true);
    });
  });

  describe("isLocationStale", () => {
    it("returns false when no cached data", () => {
      expect(isLocationStale()).toBe(false);
    });

    it("returns false when lastServerSync is recent", () => {
      localStorage.setItem(
        "islam:location",
        JSON.stringify({ lat: -6.2, lng: 106.8, timestamp: Date.now(), lastServerSync: Date.now() }),
      );
      expect(isLocationStale()).toBe(false);
    });

    it("returns true when lastServerSync is older than 24h", () => {
      const old = Date.now() - 25 * 60 * 60 * 1000; // 25h ago
      localStorage.setItem(
        "islam:location",
        JSON.stringify({ lat: -6.2, lng: 106.8, timestamp: old, lastServerSync: old }),
      );
      expect(isLocationStale()).toBe(true);
    });

    it("returns true when lastServerSync is missing (defaults to 0)", () => {
      localStorage.setItem(
        "islam:location",
        JSON.stringify({ lat: -6.2, lng: 106.8, timestamp: Date.now() }),
      );
      expect(isLocationStale()).toBe(true);
    });
  });

  describe("markServerSynced", () => {
    it("updates lastServerSync in localStorage", () => {
      const before = Date.now();
      localStorage.setItem(
        "islam:location",
        JSON.stringify({ lat: -6.2, lng: 106.8, timestamp: before, lastServerSync: 0 }),
      );
      markServerSynced();
      const raw = localStorage.getItem("islam:location");
      expect(raw).not.toBeNull();
      const data = JSON.parse(raw!);
      expect(data.lastServerSync).toBeGreaterThanOrEqual(before);
    });

    it("does nothing when no cached data", () => {
      expect(() => markServerSynced()).not.toThrow();
    });
  });
});
