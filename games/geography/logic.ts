import type { MapPoint } from "@/components/InteractiveGuessMap";

const EARTH_RADIUS_KM = 6371.0088;
const radians = (degrees: number) => degrees * Math.PI / 180;
const degrees = (radiansValue: number) => radiansValue * 180 / Math.PI;

export function haversineDistanceKm(a: MapPoint, b: MapPoint) {
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const deltaLat = radians(b.latitude - a.latitude);
  const deltaLon = radians(b.longitude - a.longitude);
  const h = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function calculateGeographicMidpoint(a: MapPoint, b: MapPoint): MapPoint {
  const lat1 = radians(a.latitude);
  const lon1 = radians(a.longitude);
  const lat2 = radians(b.latitude);
  const deltaLon = radians(b.longitude - a.longitude);
  const bx = Math.cos(lat2) * Math.cos(deltaLon);
  const by = Math.cos(lat2) * Math.sin(deltaLon);
  const latitude = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + bx) ** 2 + by ** 2)
  );
  const longitude = lon1 + Math.atan2(by, Math.cos(lat1) + bx);
  return {
    latitude: degrees(latitude),
    longitude: ((degrees(longitude) + 540) % 360) - 180
  };
}

export function calculateMeetMeHalfwayScore(distanceKm: number) {
  return distanceKm <= 50 ? 100 : distanceKm <= 100 ? 90 : distanceKm <= 250 ? 80 :
    distanceKm <= 500 ? 65 : distanceKm <= 1000 ? 50 : distanceKm <= 2000 ? 35 :
    distanceKm <= 3500 ? 20 : 0;
}

export function calculateLandmarkDropScore(distanceKm: number) {
  return distanceKm <= 5 ? 100 : distanceKm <= 25 ? 90 : distanceKm <= 100 ? 80 :
    distanceKm <= 250 ? 65 : distanceKm <= 500 ? 50 : distanceKm <= 1000 ? 35 :
    distanceKm <= 2000 ? 20 : 0;
}

export function geographyScoreLabel(score: number) {
  return score === 100 ? "Pinpoint" : score >= 80 ? "Very close" : score >= 50 ? "Close" :
    score >= 20 ? "On the map" : "Far away";
}
