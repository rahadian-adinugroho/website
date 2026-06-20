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

function dispatchChanged(): void {
  window.dispatchEvent(
    new CustomEvent("settings:changed", { detail: currentSettings }),
  );
}
