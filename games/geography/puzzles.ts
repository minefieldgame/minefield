import { LANDMARKS } from "@/data/landmarks";
import { WORLD_CITIES } from "@/data/worldCities";
import { calculateGeographicMidpoint, calculateProjectedMidpoint } from "@/games/geography/logic";
import { getDailyMasterSeed, getGameSeedForDate } from "@/lib/dailySeed";
import { createUniqueContentKey, selectNonRepeatingDailyCandidate } from "@/lib/content/usedContentRegistry";

export function resolveMeetMeHalfwayPuzzle(date: string) {
  const masterSeed = getDailyMasterSeed(date);
  const seed = getGameSeedForDate(date, "meet-me-halfway");
  const cityPairs = WORLD_CITIES.flatMap((locationA, index) =>
    WORLD_CITIES.slice(index + 1)
      .filter((locationB) =>
        Math.abs(locationB.longitude - locationA.longitude) > 40 &&
        Math.abs(locationB.latitude - locationA.latitude) > 8
      )
      .map((locationB) => ({ locationA, locationB }))
  );
  const selected = selectNonRepeatingDailyCandidate({
    gameId: "meet-me-halfway",
    dateKey: date,
    candidates: cityPairs,
    contentKey: ({ locationA, locationB }) => createUniqueContentKey("meet-me-halfway", "location-pair", [
      [locationA.name, locationA.country, locationB.name, locationB.country].sort().join("|")
    ])
  });
  const { locationA, locationB } = selected.selected;
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
    finalGameplayMidpoint: projectedMidpoint,
    uniqueContentKey: selected.check.uniqueContentKey,
    duplicateCheck: selected.check
  };
}

export function resolveLandmarkDropPuzzle(date: string) {
  const masterSeed = getDailyMasterSeed(date);
  const seed = getGameSeedForDate(date, "landmark-drop");
  const selected = selectNonRepeatingDailyCandidate({
    gameId: "landmark-drop",
    dateKey: date,
    candidates: LANDMARKS,
    contentKey: (landmark) => createUniqueContentKey("landmark-drop", "landmark-location", [
      landmark.name,
      landmark.city,
      landmark.country,
      landmark.latitude.toFixed(4),
      landmark.longitude.toFixed(4)
    ])
  });
  return {
    gameId: "landmark-drop" as const,
    date,
    masterSeed,
    gameSeed: seed,
    seed,
    landmark: selected.selected,
    uniqueContentKey: selected.check.uniqueContentKey,
    duplicateCheck: selected.check
  };
}
