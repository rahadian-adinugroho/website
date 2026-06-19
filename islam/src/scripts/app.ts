import { initPrayerTimes } from "./prayer-times";
import { initQibla, requestCompassPermission } from "./qibla";

const requestBtn = document.getElementById("request-location-btn");
const retryBtn = document.getElementById("retry-location-btn");
const locationRequest = document.getElementById("location-request");
const locationError = document.getElementById("location-error");

function handleLocationSuccess(position: GeolocationPosition) {
  const { latitude, longitude } = position.coords;

  // Hide request UI
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
  if (locationRequest) locationRequest.hidden = true;
  if (locationError) locationError.hidden = false;
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

if (requestBtn) {
  requestBtn.addEventListener("click", requestLocation);
}

if (retryBtn) {
  retryBtn.addEventListener("click", function () {
    if (locationError) locationError.hidden = true;
    if (locationRequest) locationRequest.hidden = false;
  });
}
