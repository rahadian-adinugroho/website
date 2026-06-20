import { Coordinates, Qibla } from "adhan";

let qiblaBearing = 0;
let currentHeading = 0;
let currentAccuracy: number | null = null;
let isIOS = false;
let lastRotation = 0;

export function getCurrentAccuracy(): number | null {
  return currentAccuracy;
}

export function initQibla(lat: number, lng: number): void {
  const coordinates = new Coordinates(lat, lng);
  qiblaBearing = Qibla(coordinates);
  console.log("[islam] qibla bearing:", qiblaBearing);

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
    return;
  }

  // Non-iOS: try absolute orientation first, fall back to regular
  if (typeof (window as any).DeviceOrientationEvent !== "undefined") {
    window.addEventListener("deviceorientationabsolute", handleOrientation);
    window.addEventListener("deviceorientation", handleOrientation);
    console.log("[islam] compass listeners attached (non-iOS)");
  }
}

function handleOrientation(event: DeviceOrientationEvent): void {
  let heading: number | null = null;

  // iOS: webkitCompassHeading is the true compass heading (0 = north, clockwise)
  const webkitHeading = (event as any).webkitCompassHeading;
  if (typeof webkitHeading === "number" && !isNaN(webkitHeading)) {
    heading = webkitHeading;
    // iOS also exposes webkitCompassAccuracy (degrees, lower = better)
    const accuracy = (event as any).webkitCompassAccuracy;
    if (typeof accuracy === "number" && !isNaN(accuracy)) {
      currentAccuracy = accuracy;
      window.dispatchEvent(
        new CustomEvent("qibla:accuracy", { detail: { accuracy } }),
      );
    }
  } else if (event.alpha !== null) {
    // Android/other: alpha is counterclockwise, convert to compass heading
    // Only use if event.absolute is true (means it's relative to Earth, not arbitrary)
    if (event.absolute) {
      heading = 360 - event.alpha;
    } else {
      // Non-absolute alpha is unreliable for compass — skip
      return;
    }
  }

  if (heading !== null) {
    currentHeading = heading;
    updateArrow();
  }
}

function updateArrow(): void {
  const arrow = document.getElementById("qibla-arrow");
  if (!arrow) return;

  // Arrow points to Qibla relative to device heading
  // qiblaBearing: direction to Mecca from north (clockwise)
  // currentHeading: direction device top is pointing from north (clockwise)
  const target = qiblaBearing - currentHeading;

  // Choose the equivalent angle closest to the last applied rotation so
  // the CSS transition always takes the shortest path. Without this,
  // normalizing the target to [-180, 180] each frame can cause the value
  // to oscillate between +180° and -180° (same visual direction, different
  // CSS values) when sensor noise puts the raw value near the boundary.
  let delta = ((target - lastRotation) % 360 + 540) % 360 - 180;
  const newRotation = lastRotation + delta;

  // Deadband: ignore tiny changes (< 0.5°) to prevent jitter from sensor noise
  if (Math.abs(delta) < 0.5) return;
  lastRotation = newRotation;

  arrow.style.transform = `rotate(${newRotation}deg)`;
}

export async function requestCompassPermission(): Promise<void> {
  if (!isIOS) return;

  try {
    console.log("[islam] requesting iOS compass permission...");
    const permissionResult = await (
      DeviceOrientationEvent as any
    ).requestPermission();
    console.log("[islam] compass permission:", permissionResult);
    if (permissionResult === "granted") {
      window.addEventListener("deviceorientation", handleOrientation);
      console.log("[islam] compass listener attached (iOS)");
    }
  } catch (err) {
    console.error("[islam] compass permission error:", err);
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
  window.removeEventListener("deviceorientationabsolute", handleOrientation);
}
