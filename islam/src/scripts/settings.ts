import type { Settings, CalcMethod, SunnahPrayer } from "../lib/settings";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  resolveMethod,
  getAdhanMethodName,
  detectMethodFromLocale,
} from "../lib/settings";
import { getAllPrayerTimes } from "./prayer-times";

// --- Module-level state ---

let currentSettings: Settings = DEFAULT_SETTINGS;
let isOpen = false;

// --- DOM refs (lazily cached) ---

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

// --- Public API ---

export function getCurrentSettings(): Settings {
  return currentSettings;
}

export function openSettings(): void {
  console.log("[islam] openSettings called, isOpen:", isOpen);
  if (isOpen) return;
  isOpen = true;

  const panel = $("settings-panel");
  if (!panel) return;

  // Populate current settings into the form
  applySettingsToForm(currentSettings);

  // Populate prayer times
  populatePrayerTimesList();

  // Update detected method label
  updateDetectedMethod();

  // Show panel — use requestAnimationFrame so the CSS transition applies
  panel.hidden = false;
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => {
    const container = $("settings-container");
    if (container) container.style.transform = "translateY(0)";
  });

  // Focus the close button
  requestAnimationFrame(() => $("settings-close-btn")?.focus());
}

export function closeSettings(): void {
  if (!isOpen) return;
  isOpen = false;

  const panel = $("settings-panel");
  if (panel) panel.hidden = true;
  document.body.style.overflow = "";
}

export function initSettings(): void {
  currentSettings = loadSettings();

  // Wire up event listeners (only once)
  wireEvents();
}

// --- Internal ---

function wireEvents(): void {
  // Close button
  $("settings-close-btn")?.addEventListener("click", closeSettings);

  // Backdrop click
  $("settings-backdrop")?.addEventListener("click", closeSettings);

  // Escape key
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape" && isOpen) closeSettings();
  });

  // Radio button changes (calculation method)
  document.querySelectorAll<HTMLInputElement>('input[name="settings-calc-method"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      const method = input.value as CalcMethod;
      currentSettings = { ...currentSettings, calcMethod: method };
      saveSettings(currentSettings);
      updateDetectedMethod();
      dispatchChanged();
    });
  });

  // Checkbox changes (sunnah prayers)
  document.querySelectorAll<HTMLInputElement>('input[name^="settings-sunnah-"]').forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.name.replace("settings-sunnah-", "") as SunnahPrayer;
      currentSettings = {
        ...currentSettings,
        sunnahPrayers: {
          ...currentSettings.sunnahPrayers,
          [key]: input.checked,
        },
      };
      saveSettings(currentSettings);
      dispatchChanged();
    });
  });

  // Listen for prayer:updated to refresh times shown in the panel
  window.addEventListener("prayer:updated", () => {
    if (isOpen) {
      populatePrayerTimesList();
      updateSunnahTimes();
    }
  });
}

function applySettingsToForm(settings: Settings): void {
  // Set calculation method radio
  const radio = document.querySelector<HTMLInputElement>(
    `input[name="settings-calc-method"][value="${settings.calcMethod}"]`,
  );
  if (radio) radio.checked = true;

  // Set sunnah prayer checkboxes
  (Object.keys(settings.sunnahPrayers) as SunnahPrayer[]).forEach((key) => {
    const cb = document.querySelector<HTMLInputElement>(
      `input[name="settings-sunnah-${key}"]`,
    );
    if (cb) cb.checked = settings.sunnahPrayers[key];
  });
}

function updateDetectedMethod(): void {
  const el = $("settings-detected-method");
  if (!el) return;
  const resolved = resolveMethod(currentSettings);
  el.textContent = `Using: ${getAdhanMethodName(resolved)}`;
}

function populatePrayerTimesList(): void {
  const container = $("settings-prayer-times-list");
  if (!container) return;

  const times = getAllPrayerTimes();
  if (times.length === 0) {
    container.innerHTML =
      '<p class="text-sm text-gray-400 py-2">Grant location access to see prayer times</p>';
    return;
  }

  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: undefined,
  });

  container.innerHTML = times
    .map(
      (p) => `
    <div class="flex items-center justify-between py-2 ${p.isSunnah ? "opacity-60" : ""}">
      <span class="text-sm ${p.isSunnah ? "text-gray-500 dark:text-gray-400 italic" : "text-gray-900 dark:text-gray-100"}">${p.label}</span>
      <span class="text-sm font-mono text-gray-600 dark:text-gray-400">${timeFormatter.format(p.time)}</span>
    </div>
  `,
    )
    .join("");
}

function updateSunnahTimes(): void {
  const times = getAllPrayerTimes();
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: undefined,
  });

  const sunnahMap: Record<string, string> = {};
  for (const p of times) {
    if (p.isSunnah) {
      sunnahMap[p.id] = timeFormatter.format(p.time);
    }
  }

  ["dhuha", "middleOfNight", "lastThirdOfNight"].forEach((id) => {
    const el = $(`settings-${id}-time`);
    if (el && sunnahMap[id]) {
      el.textContent = sunnahMap[id];
    }
  });
}

function dispatchChanged(): void {
  window.dispatchEvent(
    new CustomEvent("settings:changed", { detail: currentSettings }),
  );
}
