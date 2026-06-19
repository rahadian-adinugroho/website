import {
  Coordinates,
  CalculationMethod,
  PrayerTimes,
  Madhab,
} from "adhan";

let prayerTimesDisplay: PrayerTimes | null = null;
let currentLocation: Coordinates | null = null;

export function initPrayerTimes(lat: number, lng: number): void {
  const coordinates = new Coordinates(lat, lng);
  currentLocation = coordinates;

  const params = CalculationMethod.Singapore();
  params.adjustments = {
    fajr: 2,
    sunrise: -2,
    dhuhr: 2,
    asr: 2,
    maghrib: 2,
    isha: 2,
  };
  params.madhab = Madhab.Shafi;

  const date = new Date();
  prayerTimesDisplay = new PrayerTimes(coordinates, date, params);

  renderPrayerTimes();
  renderHijriDate(date);
  showPrayerTimes();
}

function renderPrayerTimes(): void {
  if (!prayerTimesDisplay) return;

  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: undefined,
  });

  const prayers: { id: string; label: string; time: Date }[] = [
    { id: "fajr", label: "Fajr", time: prayerTimesDisplay.fajr },
    { id: "sunrise", label: "Sunrise", time: prayerTimesDisplay.sunrise },
    { id: "dhuhr", label: "Dhuhr", time: prayerTimesDisplay.dhuhr },
    { id: "asr", label: "Asr", time: prayerTimesDisplay.asr },
    { id: "maghrib", label: "Maghrib", time: prayerTimesDisplay.maghrib },
    { id: "isha", label: "Isha", time: prayerTimesDisplay.isha },
  ];

  for (const prayer of prayers) {
    const el = document.getElementById(`prayer-time-${prayer.id}`);
    if (el) {
      el.textContent = timeFormatter.format(prayer.time);
    }
  }

  // Highlight current and next prayer
  highlightPrayers(prayers);
}

function highlightPrayers(
  prayers: { id: string; label: string; time: Date }[]
): void {
  const now = new Date();

  // Find the current prayer (last prayer whose time has passed)
  let currentIndex = -1;
  for (let i = prayers.length - 1; i >= 0; i--) {
    if (prayers[i].time <= now) {
      currentIndex = i;
      break;
    }
  }

  // Find the next prayer (first prayer whose time hasn't passed yet)
  let nextIndex = -1;
  for (let i = 0; i < prayers.length; i++) {
    if (prayers[i].time > now) {
      nextIndex = i;
      break;
    }
  }

  // If all prayers have passed for today, no current prayer (until midnight)
  // If no prayer has started yet, no current prayer
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
      "dark:text-primary-300"
    );

    if (i === currentIndex) {
      row.classList.add(
        "bg-primary-100",
        "dark:bg-primary-900",
        "border-l-2",
        "border-primary-500",
        "font-bold",
        "text-primary-700",
        "dark:text-primary-300"
      );
    } else if (i === nextIndex) {
      row.classList.add(
        "bg-primary-50",
        "dark:bg-primary-950",
        "border-l-2",
        "border-primary-500"
      );
    }
  }
}

function renderHijriDate(date: Date): void {
  const hijriEl = document.getElementById("hijri-date");
  if (!hijriEl) return;

  try {
    // Use built-in Islamic calendar (more accurate than manual calculation)
    const hijriStr = new Intl.DateTimeFormat("en-US-u-ca-islamic", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
    hijriEl.textContent = `${hijriStr} AH`;
  } catch {
    // Fallback: Kuwaiti algorithm (tabular Islamic calendar)
    const gd = date.getDate();
    const gm = date.getMonth() + 1;
    const gy = date.getFullYear();

    let jd =
      Math.floor((1461 * (gy + 4800 + Math.floor((gm - 14) / 12))) / 4) +
      Math.floor((367 * (gm - 2 - 12 * Math.floor((gm - 14) / 12))) / 12) -
      Math.floor(
        (3 * Math.floor((gy + 4900 + Math.floor((gm - 14) / 12)) / 100)) / 4
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
