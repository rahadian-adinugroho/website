import {
  Coordinates,
  CalculationMethod,
  PrayerTimes,
  Madhab,
  SunnahTimes,
} from "adhan";
import type { Settings, PrayerId } from "../lib/settings";
import {
  resolveMethod,
  getAdhanCalculationMethod,
} from "../lib/settings";

let prayerTimesDisplay: PrayerTimes | null = null;
let sunnahTimesDisplay: SunnahTimes | null = null;
let countdownInterval: ReturnType<typeof setInterval> | null = null;
let currentSettings: Settings | null = null;
let currentSunnahData: {
  dhuha: Date;
  middleOfNight: Date;
  lastThirdOfNight: Date;
} | null = null;

const PRAYER_NAMES: Record<string, string> = {
  fajr: "Fajr",
  sunrise: "Sunrise",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

export function initPrayerTimes(
  lat: number,
  lng: number,
  settings?: Settings,
): void {
  if (settings) currentSettings = settings;

  const coordinates = new Coordinates(lat, lng);

  // Resolve calculation method from settings or locale with coordinate fallback
  const resolved = currentSettings
    ? resolveMethod(currentSettings, lat, lng)
    : "singapore";
  const params = getAdhanCalculationMethod(resolved);

  // Apply ihtiyat (precautionary) adjustments — only for Singapore/Kemenag
  if (resolved === "singapore") {
    params.adjustments = {
      fajr: 2,
      sunrise: -2,
      dhuhr: 2,
      asr: 2,
      maghrib: 2,
      isha: 2,
    };
  } else {
    params.adjustments = {
      fajr: 0,
      sunrise: 0,
      dhuhr: 0,
      asr: 0,
      maghrib: 0,
      isha: 0,
    };
  }
  params.madhab = Madhab.Shafi;

  const date = new Date();
  prayerTimesDisplay = new PrayerTimes(coordinates, date, params);

  // Calculate sunnah times using adhan's SunnahTimes class.
  // The library correctly handles the date wrap by using tomorrow's
  // Fajr for the night duration calculation.
  sunnahTimesDisplay = new SunnahTimes(prayerTimesDisplay);

  // Dhuha = sunrise + 20 minutes
  const dhuha = new Date(prayerTimesDisplay.sunrise.getTime() + 20 * 60 * 1000);

  currentSunnahData = {
    dhuha,
    middleOfNight: sunnahTimesDisplay.middleOfTheNight,
    lastThirdOfNight: sunnahTimesDisplay.lastThirdOfTheNight,
  };

  renderPrayerTimes();
  renderHijriDate(date);
  startCountdown();
  showPrayerTimes();

  // Dispatch event so the settings panel can refresh its time display
  window.dispatchEvent(new CustomEvent("prayer:updated"));
}

export function getAllPrayerTimes(): {
  id: PrayerId;
  label: string;
  time: Date;
  isSunnah: boolean;
}[] {
  if (!prayerTimesDisplay) return [];

  const times: { id: PrayerId; label: string; time: Date; isSunnah: boolean }[] = [
    { id: "fajr", label: "Fajr", time: prayerTimesDisplay.fajr, isSunnah: false },
    { id: "sunrise", label: "Sunrise", time: prayerTimesDisplay.sunrise, isSunnah: false },
    { id: "dhuhr", label: "Dhuhr", time: prayerTimesDisplay.dhuhr, isSunnah: false },
    { id: "asr", label: "Asr", time: prayerTimesDisplay.asr, isSunnah: false },
    { id: "maghrib", label: "Maghrib", time: prayerTimesDisplay.maghrib, isSunnah: false },
    { id: "isha", label: "Isha", time: prayerTimesDisplay.isha, isSunnah: false },
  ];

  if (currentSunnahData) {
    // Insert Dhuha after Sunrise
    times.splice(2, 0, {
      id: "dhuha",
      label: "Dhuha",
      time: currentSunnahData.dhuha,
      isSunnah: true,
    });
    // Append middle-of-night and last-third after Isha
    times.push(
      {
        id: "middleOfNight",
        label: "Middle of the Night",
        time: currentSunnahData.middleOfNight,
        isSunnah: true,
      },
      {
        id: "lastThirdOfNight",
        label: "Last Third of the Night",
        time: currentSunnahData.lastThirdOfNight,
        isSunnah: true,
      },
    );
  }

  return times;
}

function renderPrayerTimes(): void {
  if (!prayerTimesDisplay) return;

  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: undefined,
  });

  const allPrayers = getAllPrayerTimes();
  const mandatoryPrayers = allPrayers.filter((p) => !p.isSunnah);

  for (const prayer of mandatoryPrayers) {
    const el = document.getElementById(`prayer-time-${prayer.id}`);
    if (el) {
      el.textContent = timeFormatter.format(prayer.time);
    }
  }

  // Show/hide and set times for sunnah prayer rows
  if (currentSettings) {
    const showDhuha = currentSettings.sunnahPrayers.dhuha;
    const showMiddle = currentSettings.sunnahPrayers.middleOfNight;
    const showLastThird = currentSettings.sunnahPrayers.lastThirdOfNight;

    ["dhuha", "middleOfNight", "lastThirdOfNight"].forEach((id) => {
      const row = document.getElementById(`prayer-row-${id}`);
      if (row) {
        row.classList.toggle("hidden", !currentSettings!.sunnahPrayers[id as keyof typeof currentSettings!.sunnahPrayers]);
      }
      const timeEl = document.getElementById(`prayer-time-${id}`);
      if (timeEl && currentSunnahData) {
        const time = currentSunnahData[id as keyof typeof currentSunnahData];
        if (time) timeEl.textContent = timeFormatter.format(time);
      }
    });
  }

  highlightPrayers(mandatoryPrayers);
}

function getNextPrayer(): { id: string; label: string; time: Date } | null {
  if (!prayerTimesDisplay) return null;

  const now = new Date();
  const prayers = getAllPrayerTimes().map((p) => ({
    id: p.id,
    label: p.label,
    time: p.time,
  }));

  for (const prayer of prayers) {
    if (prayer.time > now) {
      return prayer;
    }
  }

  // All prayers passed — next is tomorrow's Fajr
  return null;
}

function startCountdown(): void {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

function updateCountdown(): void {
  const next = getNextPrayer();
  const nameEl = document.getElementById("next-prayer-name");
  const countdownEl = document.getElementById("next-prayer-countdown");

  if (!next) {
    if (nameEl) nameEl.textContent = "Fajr (tomorrow)";
    if (countdownEl) countdownEl.textContent = "--:--:--";
    return;
  }

  if (nameEl) nameEl.textContent = next.label;

  const now = new Date();
  const diff = next.time.getTime() - now.getTime();

  if (diff <= 0) {
    if (countdownEl) countdownEl.textContent = "00:00:00";
    return;
  }

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  if (countdownEl) {
    countdownEl.textContent =
      `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
}

function highlightPrayers(
  prayers: { id: string; label: string; time: Date }[],
): void {
  const now = new Date();

  let currentIndex = -1;
  for (let i = prayers.length - 1; i >= 0; i--) {
    if (prayers[i].time <= now) {
      currentIndex = i;
      break;
    }
  }

  let nextIndex = -1;
  for (let i = 0; i < prayers.length; i++) {
    if (prayers[i].time > now) {
      nextIndex = i;
      break;
    }
  }

  for (let i = 0; i < prayers.length; i++) {
    const row = document.getElementById(`prayer-row-${prayers[i].id}`);
    if (!row) continue;

    row.classList.remove(
      "bg-primary-50",
      "dark:bg-primary-950",
      "bg-primary-100",
      "dark:bg-primary-900",
      "border-l-2",
      "border-primary-500",
      "font-bold",
      "text-primary-700",
      "dark:text-primary-300",
    );

    if (i === currentIndex) {
      row.classList.add(
        "bg-primary-100",
        "dark:bg-primary-900",
        "border-l-2",
        "border-primary-500",
        "font-bold",
        "text-primary-700",
        "dark:text-primary-300",
      );
    } else if (i === nextIndex) {
      row.classList.add(
        "bg-primary-50",
        "dark:bg-primary-950",
        "border-l-2",
        "border-primary-500",
      );
    }
  }
}

function renderHijriDate(date: Date): void {
  const hijriEl = document.getElementById("hijri-date");
  if (!hijriEl) return;

  try {
    hijriEl.textContent = new Intl.DateTimeFormat("en-US-u-ca-islamic", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    const gd = date.getDate();
    const gm = date.getMonth() + 1;
    const gy = date.getFullYear();

    let jd =
      Math.floor((1461 * (gy + 4800 + Math.floor((gm - 14) / 12))) / 4) +
      Math.floor((367 * (gm - 2 - 12 * Math.floor((gm - 14) / 12))) / 12) -
      Math.floor(
        (3 * Math.floor((gy + 4900 + Math.floor((gm - 14) / 12)) / 100)) / 4,
      ) +
      gd -
      32075;

    jd = jd - 1948440 + 10632;
    const n = Math.floor((jd - 1) / 10631);
    jd = jd - 10631 * n + 354;

    const j =
      Math.floor((10985 - jd) / 5316) * Math.floor((50 * jd) / 17719) +
      Math.floor(jd / 5670) * Math.floor((43 * jd) / 15238);
    jd =
      jd -
      Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
      Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
      29;

    const hm = Math.floor((24 * jd) / 709);
    const hd = jd - Math.floor((709 * hm) / 24);
    const hy = 30 * n + j - 30;

    const months = [
      "Muharram",
      "Safar",
      "Rabi' al-Awwal",
      "Rabi' al-Thani",
      "Jumada al-Awwal",
      "Jumada al-Thani",
      "Rajab",
      "Sha'ban",
      "Ramadan",
      "Shawwal",
      "Dhu al-Qi'dah",
      "Dhu al-Hijjah",
    ];
    const monthName = months[hm - 1] || "";
    hijriEl.textContent = `${hd} ${monthName} ${hy} AH`;
  }
}

function showPrayerTimes(): void {
  const el = document.getElementById("prayer-times");
  if (el) {
    el.removeAttribute("hidden");
  }
}
