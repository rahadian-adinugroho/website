import { describe, it, expect } from "vitest";

describe("prayer-times module", () => {
  // Smoke test: verify the module loads without errors.
  // The pure helper functions (getAllPrayerTimes, getNextPrayer) are not
  // exported and would require refactoring to test cleanly. The main
  // calculation logic lives in adhan (trusted dependency) and settings.ts
  // (comprehensively tested in settings.test.ts).
  it("module loads without errors", async () => {
    const mod = await import("./prayer-times");
    expect(mod).toBeDefined();
    expect(typeof mod.initPrayerTimes).toBe("function");
  });
});
