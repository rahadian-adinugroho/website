import { t, getLocale, setLocale, detectLocale } from "../i18n/i18n";
import type { Locale } from "../i18n/i18n";
import type { Settings, CalcMethod, SunnahPrayer } from "../lib/settings";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  resolveMethod,
  getAdhanMethodName,
} from "../lib/settings";

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
  if (isOpen) return;
  isOpen = true;

  const panel = $("settings-panel");
  if (!panel) return;

  // Populate current settings into the form
  applySettingsToForm(currentSettings);

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

  // Update detected method label on page load
  updateDetectedMethod();
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

  // Calculation method select
  const calcSelect = document.querySelector<HTMLSelectElement>('select[name="settings-calc-method"]');
  if (calcSelect) {
    calcSelect.addEventListener("change", () => {
      const method = calcSelect.value as CalcMethod;
      currentSettings = { ...currentSettings, calcMethod: method };
      saveSettings(currentSettings);
      updateDetectedMethod();
      dispatchChanged();
    });
  }

  // Language select
  const langSelect = document.querySelector<HTMLSelectElement>('select[name="settings-lang"]');
  if (langSelect) {
    langSelect.addEventListener("change", () => {
      const value = langSelect.value;
      if (value === "auto") {
        localStorage.removeItem("islam:lang");
        const detected = detectLocale();
        setLocale(detected);
      } else {
        setLocale(value as Locale);
      }
    });
  }

  // Refresh "Using: X" label when locale changes
  window.addEventListener("locale:changed", () => {
    updateDetectedMethod();
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

}

function applySettingsToForm(settings: Settings): void {
  // Set calculation method select
  const calcSelect = document.querySelector<HTMLSelectElement>('select[name="settings-calc-method"]');
  if (calcSelect) calcSelect.value = settings.calcMethod;

  // Set sunnah prayer checkboxes
  (Object.keys(settings.sunnahPrayers) as SunnahPrayer[]).forEach((key) => {
    const cb = document.querySelector<HTMLInputElement>(
      `input[name="settings-sunnah-${key}"]`,
    );
    if (cb) cb.checked = settings.sunnahPrayers[key];
  });

  // Set language select
  const langSelect = document.querySelector<HTMLSelectElement>('select[name="settings-lang"]');
  if (langSelect) {
    const stored = localStorage.getItem("islam:lang");
    langSelect.value = (stored === "en" || stored === "id") ? stored : "auto";
  }
}

function updateDetectedMethod(): void {
  const el = $("settings-detected-method");
  if (!el) return;
  const resolved = resolveMethod(currentSettings);
  el.textContent = t("settings.calcMethod.using", { method: getAdhanMethodName(resolved) });
}

function dispatchChanged(): void {
  window.dispatchEvent(
    new CustomEvent("settings:changed", { detail: currentSettings }),
  );
}
