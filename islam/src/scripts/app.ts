import { initPrayerTimes } from "./prayer-times";
import { initQibla, requestCompassPermission } from "./qibla";

const requestBtn = document.getElementById("request-location-btn");
const retryBtn = document.getElementById("retry-location-btn");
const locationRequest = document.getElementById("location-request");
const locationError = document.getElementById("location-error");

// Detect iOS Safari (iPhone/iPad) — has quirks with geolocation permissions
const isIOS =
  typeof DeviceOrientationEvent !== "undefined" &&
  typeof (DeviceOrientationEvent as any).requestPermission === "function";

console.log("[islam] init, isIOS:", isIOS);

// Render Gregorian date client-side to respect user's timezone
function renderGregorianDate(): void {
  const el = document.getElementById("gregorian-date");
  if (el) {
    el.textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}

function handleLocationSuccess(position: GeolocationPosition) {
  console.log("[islam] geolocation success:", position.coords.latitude, position.coords.longitude);
  const { latitude, longitude } = position.coords;

  // Hide all request/error UI
  if (locationRequest) locationRequest.hidden = true;
  if (locationError) locationError.hidden = true;

  // Initialize features
  initPrayerTimes(latitude, longitude);
  initQibla(latitude, longitude);

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

function handleLocationError(error: GeolocationPositionError) {
  console.log("[islam] geolocation error:", error.code, error.message);

  if (error.code === error.PERMISSION_DENIED) {
    // Permission denied — show the request button for manual retry
    if (locationError) locationError.hidden = true;
    if (locationRequest) locationRequest.hidden = false;
  } else {
    // Timeout or position unavailable — show error with retry
    if (locationRequest) locationRequest.hidden = true;
    if (locationError) locationError.hidden = false;
  }
}

function requestLocation() {
  console.log("[islam] requestLocation() called");

  if (!navigator.geolocation) {
    console.log("[islam] geolocation not supported");
    if (locationRequest) locationRequest.hidden = false;
    return;
  }

  console.log("[islam] calling getCurrentPosition...");
  navigator.geolocation.getCurrentPosition(
    handleLocationSuccess,
    handleLocationError,
    {
      enableHighAccuracy: false,
      timeout: 20000,
      maximumAge: 300000,
    }
  );
}

// Render date immediately
renderGregorianDate();

// Decide whether to auto-request or show the button
if (isIOS) {
  // iOS Safari: permissions.query is unreliable for geolocation (may return
  // "denied" even when never requested, which silently blocks getCurrentPosition).
  // Always show the button — the user tap satisfies the gesture requirement.
  console.log("[islam] iOS detected — showing button, no auto-request");
  if (locationRequest) locationRequest.hidden = false;
} else if (navigator.permissions && navigator.permissions.query) {
  // Non-iOS: check permission state
  navigator.permissions
    .query({ name: "geolocation" as PermissionName })
    .then((result) => {
      console.log("[islam] permission state:", result.state);
      if (result.state === "granted") {
        requestLocation();
      } else {
        if (locationRequest) locationRequest.hidden = false;
      }
    })
    .catch((err) => {
      console.log("[islam] permissions.query error:", err);
      if (locationRequest) locationRequest.hidden = false;
    });
} else {
  // No permissions API — show button
  console.log("[islam] no permissions API — showing button");
  if (locationRequest) locationRequest.hidden = false;
}

// Manual request button
if (requestBtn) {
  requestBtn.addEventListener("click", () => {
    console.log("[islam] request button clicked");
    requestLocation();
  });
}

// Retry button re-triggers geolocation
if (retryBtn) {
  retryBtn.addEventListener("click", function () {
    console.log("[islam] retry button clicked");
    if (locationError) locationError.hidden = true;
    requestLocation();
  });
}
