import { describe, it, expect, beforeEach } from "vitest";
import { setUserLocation, getUserLocation, clearUserLocation } from "./location";

describe("location", () => {
  beforeEach(() => {
    clearUserLocation();
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
  });
});
