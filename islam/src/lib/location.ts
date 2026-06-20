let userLat: number | null = null;
let userLng: number | null = null;

export function setUserLocation(lat: number, lng: number): void {
  userLat = lat;
  userLng = lng;
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
}
