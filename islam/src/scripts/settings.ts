import { t, getLocale, setLocale, detectLocale } from "../i18n/i18n";
import type { Locale } from "../i18n/i18n";
import type { Settings, CalcMethod, SunnahPrayer } from "../lib/settings";
import { getUserLocation } from "../lib/location";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  resolveMethod,
  getAdhanMethodName,
} from "../lib/settings";
import {
  enableNotifications,
  disableNotifications,
  updatePreferences,
  getPushSubscription,
  type PushPrefs,
} from "./push";

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
  applySettingsToForm(currentSettings);

  // Wire up event listeners (only once)
  wireEvents();

  // Update detected method label on page load
  updateDetectedMethod();

  // Check actual subscription state (from PushManager, not localStorage)
  // and update the UI accordingly.
  refreshNotificationUI();
}

/**
 * Check the actual push subscription state and update the UI.
 * - If subscribed: show "Disable Notifications" button + preference checkboxes
 *   (with saved prefs loaded into them)
 * - If not subscribed: show "Enable Notifications" button
 */
async function refreshNotificationUI(): Promise<void> {
  const subscription = await getPushSubscription();
  const enableBtn = $("enable-notifications-btn");
  const prefsEl = $("notification-prefs");

  if (subscription) {
    // Subscribed — show Disable button + checkboxes
    if (enableBtn) {
      enableBtn.textContent = t("settings.disableNotifications");
      enableBtn.dataset.enabled = "true";
    }
    if (prefsEl) prefsEl.hidden = false;

    // Load saved prefs into checkboxes
    const savedPrefs = localStorage.getItem("islam:push:prefs");
    if (savedPrefs) {
      try {
        const prefs: PushPrefs = JSON.parse(savedPrefs);
        const fajr = document.querySelector<HTMLInputElement>('input[name="notify-fajr"]');
        const dhuhr = document.querySelector<HTMLInputElement>('input[name="notify-dhuhr"]');
        const asr = document.querySelector<HTMLInputElement>('input[name="notify-asr"]');
        const maghrib = document.querySelector<HTMLInputElement>('input[name="notify-maghrib"]');
        const isha = document.querySelector<HTMLInputElement>('input[name="notify-isha"]');
        if (fajr) fajr.checked = prefs.fajr;
        if (dhuhr) dhuhr.checked = prefs.dhuhr;
        if (asr) asr.checked = prefs.asr;
        if (maghrib) maghrib.checked = prefs.maghrib;
        if (isha) isha.checked = prefs.isha;
      } catch {
        // Ignore parse errors — defaults are all checked
      }
    }
  } else {
    // Not subscribed — show Enable button
    if (enableBtn) {
      enableBtn.textContent = t("settings.enableNotifications");
      enableBtn.dataset.enabled = "false";
    }
    if (prefsEl) prefsEl.hidden = true;
  }
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

  // Refresh "Using: X" label when user location changes
  window.addEventListener("location:updated", () => {
    updateDetectedMethod();
  });

  // Push notification enable/disable button
  const enableBtn = $("enable-notifications-btn");
  if (enableBtn) {
    enableBtn.addEventListener("click", async () => {
      const isEnabled = enableBtn.dataset.enabled === "true";
      const prefs = getPushPrefs();
      try {
        if (isEnabled) {
          // Currently subscribed — disable
          await disableNotifications();
        } else {
          // Not subscribed — enable
          await enableNotifications(prefs);
        }
        // Refresh UI to reflect the new state
        await refreshNotificationUI();
      } catch (err) {
        console.error("[push] toggle failed", err);
      }
    });
  }

  // Push notification checkbox changes
  document.querySelectorAll<HTMLInputElement>('input[name^="notify-"]').forEach((input) => {
    input.addEventListener("change", () => {
      updatePreferences(getPushPrefs());
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

}

export function applySettingsToForm(settings: Settings): void {
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

  if (currentSettings.calcMethod === "automatic") {
    const loc = getUserLocation();
    const resolved = resolveMethod(
      currentSettings,
      loc?.lat,
      loc?.lng,
    );
    el.textContent = t("settings.calcMethod.using", { method: getAdhanMethodName(resolved) });
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

function dispatchChanged(): void {
  window.dispatchEvent(
    new CustomEvent("settings:changed", { detail: currentSettings }),
  );
}

function getPushPrefs(): PushPrefs {
  const fajr = document.querySelector<HTMLInputElement>('input[name="notify-fajr"]')?.checked ?? true;
  const dhuhr = document.querySelector<HTMLInputElement>('input[name="notify-dhuhr"]')?.checked ?? true;
  const asr = document.querySelector<HTMLInputElement>('input[name="notify-asr"]')?.checked ?? true;
  const maghrib = document.querySelector<HTMLInputElement>('input[name="notify-maghrib"]')?.checked ?? true;
  const isha = document.querySelector<HTMLInputElement>('input[name="notify-isha"]')?.checked ?? true;
  return { fajr, dhuhr, asr, maghrib, isha };
}
