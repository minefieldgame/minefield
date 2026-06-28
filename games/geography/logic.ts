import type { MapPoint } from "@/components/InteractiveGuessMap";
import { WORLD_CITIES } from "@/data/worldCities";

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

function mercatorY(latitude: number) {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const sin = Math.sin(radians(clamped));
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
}

function inverseMercatorY(y: number) {
  return degrees(Math.atan(Math.sinh(Math.PI * (1 - 2 * y))));
}

function shortestWrappedLongitudeMidpoint(left: number, right: number) {
  let delta = right - left;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return ((left + delta / 2 + 540) % 360) - 180;
}

export function calculateProjectedMidpoint(a: MapPoint, b: MapPoint): MapPoint {
  return {
    latitude: inverseMercatorY((mercatorY(a.latitude) + mercatorY(b.latitude)) / 2),
    longitude: shortestWrappedLongitudeMidpoint(a.longitude, b.longitude)
  };
}

const CONTINENTS: Record<string, string> = {
  "United States": "North America", Canada: "North America", Mexico: "North America", Cuba: "North America", Panama: "North America", "Costa Rica": "North America",
  Colombia: "South America", Peru: "South America", Ecuador: "South America", Venezuela: "South America", Brazil: "South America", Argentina: "South America", Chile: "South America", Uruguay: "South America", Bolivia: "South America",
  France: "Europe", Spain: "Europe", Portugal: "Europe", Germany: "Europe", Italy: "Europe", "United Kingdom": "Europe", Ireland: "Europe", Netherlands: "Europe", Belgium: "Europe", Austria: "Europe", Czechia: "Europe", Poland: "Europe", Hungary: "Europe", Greece: "Europe", Denmark: "Europe", Sweden: "Europe", Norway: "Europe", Finland: "Europe", Iceland: "Europe", Switzerland: "Europe", Ukraine: "Europe", Romania: "Europe", Russia: "Europe",
  Egypt: "Africa", Morocco: "Africa", Algeria: "Africa", Tunisia: "Africa", Senegal: "Africa", Ghana: "Africa", Nigeria: "Africa", Ethiopia: "Africa", Kenya: "Africa", Uganda: "Africa", Tanzania: "Africa", "South Africa": "Africa", Madagascar: "Africa", Mali: "Africa",
  "United Arab Emirates": "Asia", "Saudi Arabia": "Asia", Israel: "Asia", Jordan: "Asia", Lebanon: "Asia", Qatar: "Asia", Oman: "Asia", Iran: "Asia", India: "Asia", Nepal: "Asia", Bangladesh: "Asia", "Sri Lanka": "Asia", Pakistan: "Asia", Uzbekistan: "Asia", Kazakhstan: "Asia", Thailand: "Asia", Vietnam: "Asia", Singapore: "Asia", Malaysia: "Asia", Indonesia: "Asia", Philippines: "Asia", Cambodia: "Asia", Myanmar: "Asia", China: "Asia", Taiwan: "Asia", "South Korea": "Asia", Japan: "Asia", Mongolia: "Asia", Türkiye: "Asia",
  Australia: "Oceania", "New Zealand": "Oceania", Fiji: "Oceania"
};

export type GeographyScoreResult = {
  distanceKm: number;
  baseScore: number;
  continentBonus: number;
  countryBonus: number;
  regionBonus: number;
  metroBonus: number;
  finalScore: number;
  label: string;
  guessedCountry: string;
  targetCountry: string;
};

function interpolate(distance: number, start: number, end: number, high: number, low: number) {
  const ratio = Math.min(1, Math.max(0, (distance - start) / (end - start)));
  return Math.round(high - (high - low) * ratio);
}

function nearestReference(point: MapPoint) {
  return WORLD_CITIES.reduce((best, city) => {
    const distance = haversineDistanceKm(point, city);
    return distance < best.distance ? { city, distance } : best;
  }, { city: WORLD_CITIES[0], distance: Number.POSITIVE_INFINITY });
}

export function calculateMeetMeHalfwayScore(guess: MapPoint, target: MapPoint): GeographyScoreResult {
  const distanceKm = haversineDistanceKm(guess, target);
  const baseScore = distanceKm <= 25 ? 100 : distanceKm <= 100 ? interpolate(distanceKm, 25, 100, 99, 90) :
    distanceKm <= 250 ? interpolate(distanceKm, 100, 250, 89, 80) :
    distanceKm <= 500 ? interpolate(distanceKm, 250, 500, 79, 65) :
    distanceKm <= 1000 ? interpolate(distanceKm, 500, 1000, 64, 50) :
    distanceKm <= 2000 ? interpolate(distanceKm, 1000, 2000, 49, 35) :
    distanceKm <= 3500 ? interpolate(distanceKm, 2000, 3500, 34, 20) : Math.max(0, Math.round(20 - (distanceKm - 3500) / 250));
  const guessed = nearestReference(guess);
  const expected = nearestReference(target);
  const sameCountry = guessed.city.country === expected.city.country;
  const sameContinent = CONTINENTS[guessed.city.country] === CONTINENTS[expected.city.country];
  const continentBonus = sameContinent ? 5 : 0;
  const countryBonus = sameCountry && distanceKm <= 1500 ? Math.max(0, 60 - baseScore) : 0;
  const regionBonus = guessed.city.name === expected.city.name || distanceKm <= 300 ? 5 : 0;
  const finalScore = Math.min(100, Math.max(baseScore, baseScore + continentBonus + regionBonus, sameCountry && distanceKm <= 1500 ? 60 : 0));
  return {
    distanceKm, baseScore, continentBonus, countryBonus, regionBonus, metroBonus: 0, finalScore,
    label: finalScore === 100 ? "Perfect midpoint" : finalScore >= 90 ? "Almost exact" : finalScore >= 80 ? "Very close" : finalScore >= 65 ? "Good placement" : finalScore >= 50 ? "Reasonable guess" : "Far away",
    guessedCountry: guessed.city.country, targetCountry: expected.city.country
  };
}

export function calculateLandmarkDropScore(
  guess: MapPoint,
  target: MapPoint,
  targetCountry: string,
  targetCity: string
): GeographyScoreResult {
  const distanceKm = haversineDistanceKm(guess, target);
  const baseScore = distanceKm <= 10 ? 100 : distanceKm <= 50 ? interpolate(distanceKm, 10, 50, 99, 90) :
    distanceKm <= 150 ? interpolate(distanceKm, 50, 150, 89, 80) :
    distanceKm <= 300 ? interpolate(distanceKm, 150, 300, 79, 65) :
    distanceKm <= 600 ? interpolate(distanceKm, 300, 600, 64, 50) :
    distanceKm <= 1200 ? interpolate(distanceKm, 600, 1200, 49, 30) : Math.max(0, Math.round(30 - (distanceKm - 1200) / 200));
  const guessed = nearestReference(guess);
  const sameCountry = guessed.city.country === targetCountry;
  const sameContinent = CONTINENTS[guessed.city.country] === CONTINENTS[targetCountry];
  const metroMatch = guessed.city.name.toLowerCase() === targetCity.toLowerCase() || distanceKm <= 75;
  const continentBonus = sameContinent ? 5 : 0;
  const countryBonus = sameCountry && distanceKm <= 1500 ? Math.max(0, 50 - baseScore) : 0;
  const regionBonus = sameCountry && distanceKm <= 400 ? 5 : 0;
  const metroBonus = metroMatch ? 5 : 0;
  const finalScore = Math.min(100, Math.max(baseScore, baseScore + continentBonus + regionBonus + metroBonus, sameCountry && distanceKm <= 1500 ? 50 : 0));
  return {
    distanceKm, baseScore, continentBonus, countryBonus, regionBonus, metroBonus, finalScore,
    label: finalScore === 100 ? "Picture perfect" : finalScore >= 90 ? "Almost exact" : finalScore >= 80 ? "Great spot" : finalScore >= 65 ? "Close enough" : finalScore >= 50 ? "Good guess" : "Far away",
    guessedCountry: guessed.city.country, targetCountry
  };
}

export function geographyScoreLabel(score: number, game: "midpoint" | "landmark" = "midpoint") {
  if (game === "landmark") return score === 100 ? "Picture perfect" : score >= 90 ? "Almost exact" : score >= 80 ? "Great spot" : score >= 65 ? "Close enough" : score >= 50 ? "Good guess" : "Far away";
  return score === 100 ? "Perfect midpoint" : score >= 90 ? "Almost exact" : score >= 80 ? "Very close" : score >= 65 ? "Good placement" : score >= 50 ? "Reasonable guess" : "Far away";
}
