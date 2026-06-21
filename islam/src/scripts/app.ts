import { initI18n, t, getLocale } from "../i18n/i18n";
import { initPrayerTimes } from "./prayer-times";
import {
  initCompass,
  destroyCompass,
  requestCompassPermission,
} from "./qibla";
import { loadSettings } from "../lib/settings";
import { setUserLocation, getUserLocation, loadCachedLocation } from "../lib/location";
import { initSettings, openSettings, closeSettings } from "./settings";

const requestBtn = document.getElementById("request-location-btn");
const retryBtn = document.getElementById("retry-location-btn");
const locationRequest = document.getElementById("location-request");
const locationError = document.getElementById("location-error");

// Detect iOS Safari (iPhone/iPad) — has quirks with geolocation permissions
const isIOS =
  typeof DeviceOrientationEvent !== "undefined" &&
  typeof (DeviceOrientationEvent as any).requestPermission === "function";

console.log("[islam] init, isIOS:", isIOS);

// Initialize i18n first
initI18n();

// Register service worker for push notifications
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(console.error);
}

// Tab state
let activeTab: "prayer-times" | "qibla" = "prayer-times";
let userLat: number | null = null;
let userLng: number | null = null;

// --- Tab switching ---

function switchTab(tab: "prayer-times" | "qibla") {
  if (tab === activeTab) return;
  activeTab = tab;

  const btnPrayer = document.getElementById("tab-btn-prayer-times");
  const btnQibla = document.getElementById("tab-btn-qibla");
  const panelPrayer = document.getElementById("tab-panel-prayer-times");
  const panelQibla = document.getElementById("tab-panel-qibla");

  // Update button styles
  const activeClasses = [
    "text-primary-700",
    "dark:text-primary-400",
    "border-primary-600",
  ];
  const inactiveClasses = [
    "text-gray-500",
    "dark:text-gray-400",
    "border-transparent",
  ];

  if (btnPrayer) {
    btnPrayer.classList.remove(...(tab === "prayer-times" ? inactiveClasses : activeClasses));
    btnPrayer.classList.add(...(tab === "prayer-times" ? activeClasses : inactiveClasses));
    btnPrayer.setAttribute("aria-selected", String(tab === "prayer-times"));
  }
  if (btnQibla) {
    btnQibla.classList.remove(...(tab === "qibla" ? inactiveClasses : activeClasses));
    btnQibla.classList.add(...(tab === "qibla" ? activeClasses : inactiveClasses));
    btnQibla.setAttribute("aria-selected", String(tab === "qibla"));
  }

  // Toggle panels
  if (panelPrayer) panelPrayer.hidden = tab !== "prayer-times";
  if (panelQibla) panelQibla.hidden = tab !== "qibla";

  // Lifecycle: init / destroy Qibla to avoid sensor CPU when not visible
  if (tab === "qibla") {
    if (userLat !== null && userLng !== null) {
      initCompass(userLat, userLng);
    }
  } else {
    destroyCompass();
    // Stop SVG <animateMotion> animations that may still be running
    // on the hidden Qibla tab. Without this, the animation timeline
    // continues even though the element is display:none, causing
    // continuous repaints and CPU drain (observed on iOS Safari).
    window.dispatchEvent(new CustomEvent("qibla:tab-hidden"));
  }
}

// --- Geolocation ---

function handleLocationSuccess(position: GeolocationPosition) {
  console.log(
    "[islam] geolocation success:",
    position.coords.latitude,
    position.coords.longitude,
  );
  const { latitude, longitude } = position.coords;

  // Store for later use by Qibla tab
  userLat = latitude;
  userLng = longitude;

  // Make location available to other modules (e.g., settings panel)
  setUserLocation(latitude, longitude);
  // Refresh the "Using: X" label in the settings panel (if open)
  window.dispatchEvent(new CustomEvent("location:updated"));

  // Hide all request/error UI
  if (locationRequest) locationRequest.hidden = true;
  if (locationError) locationError.hidden = true;

  // Show next-prayer card (shared above tabs)
  const nextPrayerCard = document.getElementById("next-prayer-card");
  if (nextPrayerCard) nextPrayerCard.hidden = false;

  // Initialize prayer times with current settings (always, regardless of tab)
  const settings = loadSettings();
  initPrayerTimes(latitude, longitude, settings);

  // If the Qibla tab is already active (e.g., user switched before location
  // arrived), initialize Qibla now.
  if (activeTab === "qibla") {
    initCompass(latitude, longitude);
  }

  // Check if iOS compass permission is needed
  const compassBtn = document.getElementById("compass-permission-btn");
  if (compassBtn && isIOS) {
    compassBtn.hidden = false;
    compassBtn.addEventListener("click", async () => {
      console.log("[islam] requesting compass permission");
      await requestCompassPermission();
      compassBtn.hidden = true;
    });
  }
}

// --- Init ---

// Render date immediately
function renderGregorianDate(): void {
  const el = document.getElementById("gregorian-date");
  if (el) {
    el.textContent = new Date().toLocaleDateString(getLocale(), {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}
renderGregorianDate();

// Re-render gregorian date when language changes
window.addEventListener("locale:changed", () => {
  renderGregorianDate();
});

// Initialize settings panel
initSettings();

// Wire gear button
document.getElementById("settings-gear-btn")?.addEventListener("click", openSettings);

// Re-init prayer times when settings change
window.addEventListener("settings:changed", ((e: CustomEvent) => {
  if (userLat !== null && userLng !== null) {
    initPrayerTimes(userLat, userLng, e.detail);
  }
}) as EventListener);

// Wire tab buttons
document.getElementById("tab-btn-prayer-times")?.addEventListener("click", () => {
  switchTab("prayer-times");
});
document.getElementById("tab-btn-qibla")?.addEventListener("click", () => {
  switchTab("qibla");
});

// Hydrate location from cache so the UI renders immediately from cached data.
// This allows prayer times to show instantly on repeat visits (including offline).
if (loadCachedLocation()) {
  const loc = getUserLocation();
  if (loc) {
    userLat = loc.lat;
    userLng = loc.lng;

    // Show next-prayer card
    const nextPrayerCard = document.getElementById("next-prayer-card");
    if (nextPrayerCard) nextPrayerCard.hidden = false;

    // Initialize prayer times immediately from cached location
    const settings = loadSettings();
    initPrayerTimes(loc.lat, loc.lng, settings);

    // Notify the settings panel so the "Using: X" label updates
    window.dispatchEvent(new CustomEvent("location:updated"));
  }
}

// Auto-request geolocation on page load for all platforms.
// If permission is already granted, the browser returns the position
// immediately without showing a prompt. If not decided, it shows the
// prompt. If denied, the error handler shows the button for manual retry.
console.log("[islam] auto-requesting geolocation");

function requestLocation() {
  if (!navigator.geolocation) {
    console.log("[islam] geolocation not supported");
    if (locationRequest) locationRequest.hidden = false;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    handleLocationSuccess,
    handleLocationError,
    { enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 },
  );
}
requestLocation();

// Manual request button
requestBtn?.addEventListener("click", () => {
  console.log("[islam] request button clicked");
  requestLocation();
});

// Retry button re-triggers geolocation
retryBtn?.addEventListener("click", () => {
  console.log("[islam] retry button clicked");
  if (locationError) locationError.hidden = true;
  requestLocation();
});

// --- Location error handler (kept at end for readability) ---

function handleLocationError(error: GeolocationPositionError) {
  console.log("[islam] geolocation error:", error.code, error.message);

  const errorMsg = document.getElementById("location-error-msg");

  if (error.code === error.PERMISSION_DENIED) {
    if (isIOS) {
      if (errorMsg) {
        errorMsg.innerHTML = "<strong>" + t("location.errorDeniedIos") + "</strong>";
      }
      if (locationRequest) locationRequest.hidden = true;
      if (locationError) locationError.hidden = false;
    } else {
      if (locationError) locationError.hidden = true;
      if (locationRequest) locationRequest.hidden = false;
    }
  } else if (error.code === error.POSITION_UNAVAILABLE) {
    if (errorMsg) {
      errorMsg.textContent = t("location.errorUnavailable");
    }
    if (locationRequest) locationRequest.hidden = true;
    if (locationError) locationError.hidden = false;
  } else {
    // Timeout
    if (errorMsg) {
      errorMsg.textContent = t("location.errorTimeout");
    }
    if (locationRequest) locationRequest.hidden = true;
    if (locationError) locationError.hidden = false;
  }
}
