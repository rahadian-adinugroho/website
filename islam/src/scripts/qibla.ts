import { Coordinates, Qibla } from "adhan";

let qiblaBearing = 0;
let currentHeading = 0;
let isCompassActive = false;
let isIOS = false;

export function initQibla(lat: number, lng: number): void {
  const coordinates = new Coordinates(lat, lng);
  qiblaBearing = Qibla(coordinates);

  // Check if iOS
  isIOS =
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof (DeviceOrientationEvent as any).requestPermission === "function";

  showCompass();
  startCompass();
}

function startCompass(): void {
  if (isIOS) {
    // iOS requires user gesture to request permission
    // We expose requestCompassPermission separately
    return;
  }

  // Non-iOS: listen directly
  window.addEventListener("deviceorientation", handleOrientation);
  isCompassActive = true;
}

function handleOrientation(event: DeviceOrientationEvent): void {
  const heading = event.alpha; // 0-360, compass heading
  if (heading !== null) {
    currentHeading = heading;
    updateArrow();
  }
}

function updateArrow(): void {
  const arrow = document.getElementById("qibla-arrow");
  if (!arrow) return;

  // The arrow points to Qibla relative to device heading
  const rotation = qiblaBearing - currentHeading;
  arrow.style.transform = `rotate(${rotation}deg)`;
}

export async function requestCompassPermission(): Promise<void> {
  if (!isIOS) return;

  try {
    const permissionResult = await (
      DeviceOrientationEvent as any
    ).requestPermission();
    if (permissionResult === "granted") {
      window.addEventListener("deviceorientation", handleOrientation);
      isCompassActive = true;
    }
  } catch (err) {
    console.error("Compass permission error:", err);
  }
}

function showCompass(): void {
  const el = document.getElementById("qibla-compass");
  if (el) {
    el.removeAttribute("hidden");
  }
}

// Cleanup
export function destroyQibla(): void {
  window.removeEventListener("deviceorientation", handleOrientation);
  isCompassActive = false;
}
