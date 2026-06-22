const STORAGE_KEY = "islam:location";
const DRIFT_THRESHOLD_DEGREES = 0.1;  // ~11 km
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;  // 24 hours

let userLat: number | null = null;
let userLng: number | null = null;
let _isFromCache: boolean = false;

export function setUserLocation(lat: number, lng: number, fromCache: boolean = false): void {
  userLat = lat;
  userLng = lng;
  _isFromCache = fromCache;
  persistToLocalStorage(lat, lng);
}

function persistToLocalStorage(lat: number, lng: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    // Preserve lastServerSync from existing cache so it isn't lost on GPS update
    let lastServerSync = 0;
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed.lastServerSync && typeof parsed.lastServerSync === "number") {
        lastServerSync = parsed.lastServerSync;
      }
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ lat, lng, timestamp: Date.now(), lastServerSync }),
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

export function isLocationFromCache(): boolean {
  return _isFromCache;
}

export function clearUserLocation(): void {
  userLat = null;
  userLng = null;
  _isFromCache = false;
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
    _isFromCache = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns true if the new position differs from the in-memory position
 * by more than the drift threshold (~11 km), or if no position is set.
 */
export function hasLocationDrift(newLat: number, newLng: number): boolean {
  if (userLat === null || userLng === null) return true;
  return (
    Math.abs(newLat - userLat) > DRIFT_THRESHOLD_DEGREES ||
    Math.abs(newLng - userLng) > DRIFT_THRESHOLD_DEGREES
  );
}

/**
 * Returns true if the last server sync was more than 24 hours ago.
 */
export function isLocationStale(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const cached = JSON.parse(raw);
    return Date.now() - (cached.lastServerSync ?? 0) > STALE_THRESHOLD_MS;
  } catch {
    return false;
  }
}

/**
 * Update lastServerSync to now, persist to localStorage.
 */
export function markServerSynced(): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const cached = JSON.parse(raw);
    cached.lastServerSync = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // Ignore errors
  }
}
