import { initPrayerTimes } from "./prayer-times";
import { initQibla, requestCompassPermission } from "./qibla";

const requestBtn = document.getElementById("request-location-btn");
const retryBtn = document.getElementById("retry-location-btn");
const locationRequest = document.getElementById("location-request");
const locationError = document.getElementById("location-error");

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
  const { latitude, longitude } = position.coords;

  // Hide all request/error UI
  if (locationRequest) locationRequest.hidden = true;
  if (locationError) locationError.hidden = true;

  // Initialize features
  initPrayerTimes(latitude, longitude);
  initQibla(latitude, longitude);

  // Check if iOS compass permission is needed
  const compassBtn = document.getElementById("compass-permission-btn");
  const isIOS =
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof (DeviceOrientationEvent as any).requestPermission === "function";
  if (compassBtn && isIOS) {
    compassBtn.hidden = false;
    compassBtn.addEventListener("click", async () => {
      await requestCompassPermission();
      compassBtn.hidden = true;
    });
  }
}

function handleLocationError() {
  // Hide any stale error, show the request button for manual retry
  if (locationError) locationError.hidden = true;
  if (locationRequest) locationRequest.hidden = false;
}

function requestLocation() {
  if (!navigator.geolocation) {
    handleLocationError();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    handleLocationSuccess,
    handleLocationError,
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
}

// Render date immediately
renderGregorianDate();

// Auto-request geolocation on page load
requestLocation();

// Manual request button (shown only after permission denied)
if (requestBtn) {
  requestBtn.addEventListener("click", requestLocation);
}

// Retry button hides error and re-triggers request
if (retryBtn) {
  retryBtn.addEventListener("click", function () {
    if (locationError) locationError.hidden = true;
    requestLocation();
  });
}
