import { describe, it, expect } from "vitest";
import { getCurrentAndNextPrayerIdx } from "./prayer-times";

/**
 * Helper: create a prayer entry with only the fields needed for index lookup.
 * Times are given as "HH:MM" (24h) on a fixed reference date.
 */
function p(timeStr: string): { time: Date } {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date("2025-01-01T00:00:00Z");
  d.setUTCHours(h, m, 0, 0);
  return { time: d };
}

/** Helper: create a Date at a given "HH:MM" on the same reference date. */
function t(timeStr: string): Date {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date("2025-01-01T00:00:00Z");
  d.setUTCHours(h, m, 0, 0);
  return d;
}

// Typical prayer times order: Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha
const PRAYER_TIMES = ["04:30", "05:45", "12:00", "15:15", "17:45", "19:00"];

describe("getCurrentAndNextPrayerIdx", () => {
  it("returns current=-1, next=0 when time is before the first prayer", () => {
    const prayers = PRAYER_TIMES.map(p);
    const { currentIndex, nextIndex } = getCurrentAndNextPrayerIdx(prayers, t("03:00"));
    expect(currentIndex).toBe(-1);
    expect(nextIndex).toBe(0); // Fajr
  });

  it("returns current=0 (Fajr) when time is exactly at Fajr", () => {
    const prayers = PRAYER_TIMES.map(p);
    const { currentIndex, nextIndex } = getCurrentAndNextPrayerIdx(prayers, t("04:30"));
    expect(currentIndex).toBe(0); // Fajr is current
    expect(nextIndex).toBe(1);    // Sunrise is next
  });

  it("returns current=0 (Fajr) 1 minute after Fajr", () => {
    const prayers = PRAYER_TIMES.map(p);
    const { currentIndex, nextIndex } = getCurrentAndNextPrayerIdx(prayers, t("04:31"));
    expect(currentIndex).toBe(0); // Fajr is still current
    expect(nextIndex).toBe(1);    // Sunrise is next
  });

  it("returns current=0 (Fajr), next=1 (Sunrise) 1 minute before Sunrise", () => {
    const prayers = PRAYER_TIMES.map(p);
    const { currentIndex, nextIndex } = getCurrentAndNextPrayerIdx(prayers, t("05:44"));
    expect(currentIndex).toBe(0); // Fajr is current (Sunrise hasn't started)
    expect(nextIndex).toBe(1);    // Sunrise is next
  });

  it("returns current=1 (Sunrise) at Sunrise time, next=2 (Dhuhr)", () => {
    const prayers = PRAYER_TIMES.map(p);
    const { currentIndex, nextIndex } = getCurrentAndNextPrayerIdx(prayers, t("05:45"));
    expect(currentIndex).toBe(1); // Sunrise is current
    expect(nextIndex).toBe(2);    // Dhuhr is next
  });

  it("returns current=3 (Asr), next=4 (Maghrib) between Asr and Maghrib", () => {
    const prayers = PRAYER_TIMES.map(p);
    const { currentIndex, nextIndex } = getCurrentAndNextPrayerIdx(prayers, t("16:00"));
    expect(currentIndex).toBe(3); // Asr is current
    expect(nextIndex).toBe(4);    // Maghrib is next
  });

  it("returns current=5 (Isha), next=-1 when after Isha", () => {
    const prayers = PRAYER_TIMES.map(p);
    const { currentIndex, nextIndex } = getCurrentAndNextPrayerIdx(prayers, t("22:00"));
    expect(currentIndex).toBe(5); // Isha is current
    expect(nextIndex).toBe(-1);   // No more prayers today
  });

  it("returns current=-1, next=0 when time is before Fajr (midnight case)", () => {
    const prayers = PRAYER_TIMES.map(p);
    const { currentIndex, nextIndex } = getCurrentAndNextPrayerIdx(prayers, t("00:15"));
    expect(currentIndex).toBe(-1);
    expect(nextIndex).toBe(0); // Fajr
  });

  it("handles empty prayer list", () => {
    const { currentIndex, nextIndex } = getCurrentAndNextPrayerIdx([], t("12:00"));
    expect(currentIndex).toBe(-1);
    expect(nextIndex).toBe(-1);
  });

  it("handles single prayer in list — before it", () => {
    const prayers = [{ time: t("12:00") }];
    const { currentIndex, nextIndex } = getCurrentAndNextPrayerIdx(prayers, t("11:00"));
    expect(currentIndex).toBe(-1);
    expect(nextIndex).toBe(0);
  });

  it("handles single prayer in list — at it", () => {
    const prayers = [{ time: t("12:00") }];
    const { currentIndex, nextIndex } = getCurrentAndNextPrayerIdx(prayers, t("12:00"));
    expect(currentIndex).toBe(0);
    expect(nextIndex).toBe(-1);
  });

  it("handles single prayer in list — after it", () => {
    const prayers = [{ time: t("12:00") }];
    const { currentIndex, nextIndex } = getCurrentAndNextPrayerIdx(prayers, t("13:00"));
    expect(currentIndex).toBe(0);
    expect(nextIndex).toBe(-1);
  });
});
