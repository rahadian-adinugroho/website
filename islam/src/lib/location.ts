const STORAGE_KEY = "islam:location";

let userLat: number | null = null;
let userLng: number | null = null;

export function setUserLocation(lat: number, lng: number): void {
  userLat = lat;
  userLng = lng;
  persistToLocalStorage(lat, lng);
}

function persistToLocalStorage(lat: number, lng: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ lat, lng, timestamp: Date.now() }),
    );
  } catch {
    // Quota exceeded or other storage error — fail silently
  }
}

export function getUserLocation(): { lat: number; lng: number } | null {
  if (userLat !== null && userLng !== null) {
    return { lat: userLat, lng: userLng };
  }
  return null;
}

export function clearUserLocation(): void {
  userLat = null;
  userLng = null;
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // fail silently
  }
}

/**
 * Load cached location from localStorage into module memory.
 * Returns true if a valid cached location was found, false otherwise.
 */
export function loadCachedLocation(): boolean {
  if (typeof localStorage === "undefined") return false;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    const data = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return false;
    if (typeof data.lat !== "number" || typeof data.lng !== "number") return false;

    userLat = data.lat;
    userLng = data.lng;
    return true;
  } catch {
    return false;
  }
}
