import { LANDMARKS } from "@/data/landmarks";
import { WORLD_CITIES } from "@/data/worldCities";
import { calculateGeographicMidpoint, calculateProjectedMidpoint } from "@/games/geography/logic";
import { getDailyMasterSeed, getGameSeedForDate, seededShuffle } from "@/lib/dailySeed";

export function resolveMeetMeHalfwayPuzzle(date: string) {
  const masterSeed = getDailyMasterSeed(date);
  const seed = getGameSeedForDate(date, "meet-me-halfway");
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
    masterSeed,
    gameSeed: seed,
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
  const masterSeed = getDailyMasterSeed(date);
  const seed = getGameSeedForDate(date, "landmark-drop");
  const landmark = LANDMARKS[seed % LANDMARKS.length];
  return { gameId: "landmark-drop" as const, date, masterSeed, gameSeed: seed, seed, landmark };
}
