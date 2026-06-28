import { LANDMARKS } from "@/data/landmarks";
import { WORLD_CITIES } from "@/data/worldCities";
import { calculateGeographicMidpoint, calculateProjectedMidpoint } from "@/games/geography/logic";
import { hashString, seededShuffle } from "@/lib/dailySeed";

export function resolveMeetMeHalfwayPuzzle(date: string) {
  const seed = hashString(`meet-me-halfway:${date}`);
  const selected = seededShuffle(WORLD_CITIES, seed);
  const locationA = selected[0];
  const locationB = selected.find((city) =>
    city !== locationA &&
    Math.abs(city.longitude - locationA.longitude) > 40 &&
    Math.abs(city.latitude - locationA.latitude) > 8
  ) ?? selected[1];
  const sphericalMidpoint = calculateGeographicMidpoint(locationA, locationB);
  const projectedMidpoint = calculateProjectedMidpoint(locationA, locationB);
  return {
    gameId: "meet-me-halfway" as const,
    date,
    seed,
    locationA,
    locationB,
    sphericalMidpoint,
    projectedMidpoint,
    midpoint: projectedMidpoint,
    finalGameplayMidpoint: projectedMidpoint
  };
}

export function resolveLandmarkDropPuzzle(date: string) {
  const seed = hashString(`landmark-drop:${date}`);
  const landmark = LANDMARKS[seed % LANDMARKS.length];
  return { gameId: "landmark-drop" as const, date, seed, landmark };
}
