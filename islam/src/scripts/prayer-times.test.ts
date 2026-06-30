import { describe, it, expect, beforeEach } from "vitest";
import {
  getCurrentAndNextPrayerIdx,
  formatCountdown,
  shouldReinitializePrayerTimes,
  getHijriMonthName,
  getHijriCalendar,
} from "./prayer-times";
import { setLocale } from "../i18n/i18n";

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

  it("transitions next index at the exact prayer time (auto-transition)", () => {
    const prayers = PRAYER_TIMES.map(p);
    // At 04:29, next is Fajr (index 0)
    expect(getCurrentAndNextPrayerIdx(prayers, t("04:29")).nextIndex).toBe(0);
    // At 04:30 exactly, Fajr is now current, next becomes Sunrise (index 1)
    const { currentIndex, nextIndex } = getCurrentAndNextPrayerIdx(prayers, t("04:30"));
    expect(currentIndex).toBe(0);  // Fajr is current
    expect(nextIndex).toBe(1);     // Sunrise is next — auto-transitioned
  });

  it("transitions through all prayers in sequence", () => {
    const prayers = PRAYER_TIMES.map(p);
    // One second before each prayer, next points to it
    expect(getCurrentAndNextPrayerIdx(prayers, t("04:29")).nextIndex).toBe(0);  // Fajr
    expect(getCurrentAndNextPrayerIdx(prayers, t("05:44")).nextIndex).toBe(1);  // Sunrise
    expect(getCurrentAndNextPrayerIdx(prayers, t("11:59")).nextIndex).toBe(2);  // Dhuhr
    expect(getCurrentAndNextPrayerIdx(prayers, t("15:14")).nextIndex).toBe(3);  // Asr
    expect(getCurrentAndNextPrayerIdx(prayers, t("17:44")).nextIndex).toBe(4);  // Maghrib
    expect(getCurrentAndNextPrayerIdx(prayers, t("18:59")).nextIndex).toBe(5);  // Isha
    // At or after Isha, next is -1
    expect(getCurrentAndNextPrayerIdx(prayers, t("19:00")).nextIndex).toBe(-1);
    expect(getCurrentAndNextPrayerIdx(prayers, t("22:00")).nextIndex).toBe(-1);
  });
});

describe("formatCountdown", () => {
  const base = new Date("2025-01-01T12:00:00Z");

  it("returns HH:MM:SS when target is in the future", () => {
    const target = new Date(base.getTime() + 3661 * 1000); // 1h 1m 1s
    expect(formatCountdown(target, base)).toBe("01:01:01");
  });

  it("returns 00:00:00 when target is exactly now", () => {
    expect(formatCountdown(base, base)).toBe("00:00:00");
  });

  it("returns 00:00:00 when target is in the past", () => {
    const target = new Date(base.getTime() - 1000);
    expect(formatCountdown(target, base)).toBe("00:00:00");
  });

  it("pads single-digit hours, minutes, seconds", () => {
    const target = new Date(base.getTime() + 5 * 1000); // 5 seconds
    expect(formatCountdown(target, base)).toBe("00:00:05");
  });

  it("handles large durations (many hours)", () => {
    const target = new Date(base.getTime() + 25 * 3600 * 1000); // 25 hours
    expect(formatCountdown(target, base)).toBe("25:00:00");
  });
});

describe("shouldReinitializePrayerTimes", () => {
  it("returns false when lastInitDate is null", () => {
    expect(shouldReinitializePrayerTimes(null, new Date("2026-06-23T12:00:00"))).toBe(false);
  });

  it("returns false when dates match", () => {
    const last = new Date("2026-06-23T08:00:00").toDateString();
    const now = new Date("2026-06-23T20:00:00");
    expect(shouldReinitializePrayerTimes(last, now)).toBe(false);
  });

  it("returns true when dates differ (day rollover)", () => {
    const last = new Date("2026-06-23T23:59:00").toDateString();
    const now = new Date("2026-06-24T00:01:00");
    expect(shouldReinitializePrayerTimes(last, now)).toBe(true);
  });

  it("returns true when dates differ by more than one day (e.g., laptop reopened days later)", () => {
    const last = new Date("2026-06-23T20:00:00").toDateString();
    const now = new Date("2026-06-26T08:00:00");
    expect(shouldReinitializePrayerTimes(last, now)).toBe(true);
  });

  it("handles month boundary", () => {
    const last = new Date("2026-06-30T23:59:00").toDateString();
    const now = new Date("2026-07-01T00:01:00");
    expect(shouldReinitializePrayerTimes(last, now)).toBe(true);
  });

  it("handles year boundary", () => {
    const last = new Date("2026-12-31T23:59:00").toDateString();
    const now = new Date("2027-01-01T00:01:00");
    expect(shouldReinitializePrayerTimes(last, now)).toBe(true);
  });
});

describe("getHijriMonthName", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns English month names 1–12", () => {
    setLocale("en");
    expect(getHijriMonthName(1)).toBe("Muharram");
    expect(getHijriMonthName(2)).toBe("Safar");
    expect(getHijriMonthName(3)).toBe("Rabi' al-Awwal");
    expect(getHijriMonthName(4)).toBe("Rabi' al-Thani");
    expect(getHijriMonthName(5)).toBe("Jumada al-Awwal");
    expect(getHijriMonthName(6)).toBe("Jumada al-Thani");
    expect(getHijriMonthName(7)).toBe("Rajab");
    expect(getHijriMonthName(8)).toBe("Sha'ban");
    expect(getHijriMonthName(9)).toBe("Ramadan");
    expect(getHijriMonthName(10)).toBe("Shawwal");
    expect(getHijriMonthName(11)).toBe("Dhu al-Qi'dah");
    expect(getHijriMonthName(12)).toBe("Dhu al-Hijjah");
  });

  it("returns Indonesian month names 1–12", () => {
    setLocale("id");
    expect(getHijriMonthName(1)).toBe("Muharram");
    expect(getHijriMonthName(2)).toBe("Safar");
    expect(getHijriMonthName(3)).toBe("Rabiul Awal");
    expect(getHijriMonthName(4)).toBe("Rabiul Akhir");
    expect(getHijriMonthName(5)).toBe("Jumadil Awal");
    expect(getHijriMonthName(6)).toBe("Jumadil Akhir");
    expect(getHijriMonthName(7)).toBe("Rajab");
    expect(getHijriMonthName(8)).toBe("Sya'ban");
    expect(getHijriMonthName(9)).toBe("Ramadan");
    expect(getHijriMonthName(10)).toBe("Syawal");
    expect(getHijriMonthName(11)).toBe("Dzulkaidah");
    expect(getHijriMonthName(12)).toBe("Dzulhijjah");
  });

  it("returns empty string for out-of-range month", () => {
    setLocale("en");
    expect(getHijriMonthName(0)).toBe("");
    expect(getHijriMonthName(13)).toBe("");
    expect(getHijriMonthName(-1)).toBe("");
  });
});

describe("getHijriCalendar", () => {
  it("returns islamic-umalqura for the Umm al-Qura method", () => {
    expect(getHijriCalendar("ummAlQura")).toBe("islamic-umalqura");
  });

  it("returns islamic-tbla for all other methods (singapore, MWL, etc.)", () => {
    // Regression: commit that switched to islamic-civil showed dates 1 day
    // behind. islamic-tbla is the correct variant.
    expect(getHijriCalendar("singapore")).toBe("islamic-tbla");
    expect(getHijriCalendar("muslimWorldLeague")).toBe("islamic-tbla");
    expect(getHijriCalendar("egyptian")).toBe("islamic-tbla");
    expect(getHijriCalendar("karachi")).toBe("islamic-tbla");
    expect(getHijriCalendar("northAmerica")).toBe("islamic-tbla");
    expect(getHijriCalendar("tehran")).toBe("islamic-tbla");
    expect(getHijriCalendar("turkey")).toBe("islamic-tbla");
  });
});
