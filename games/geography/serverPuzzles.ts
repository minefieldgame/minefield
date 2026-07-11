import "server-only";

import type { Landmark } from "@/data/landmarks";
import { WORLD_CITIES } from "@/data/worldCities";
import { calculateGeographicMidpoint, calculateProjectedMidpoint, haversineDistanceKm } from "@/games/geography/logic";
import { selectFromContentUniverse, seededUniverseSelector, type ContentUniverseDiagnostics } from "@/lib/content/contentUniverse";
import { createUsedContentRecord, createUniqueContentKey, contentHashFromKey } from "@/lib/content/usedContentRegistry";
import { getDailyMasterSeed, getGameSeedForDate } from "@/lib/dailySeed";
import { getInventoryUsageCounts, getPersistedPuzzle, publishDailyPuzzleWithUsedContent } from "@/lib/content/persistence";
import { CONTENT_INVENTORY_POLICY } from "@/lib/content/inventoryPolicy";
import { getAllLandmarkCandidates, replenishLandmarkCandidates } from "@/lib/content/landmarkInventory";

type City = typeof WORLD_CITIES[number];
type CityPair = { id: string; locationA: City; locationB: City };

function cityId(city: City) {
  return createUniqueContentKey("city", "location", [city.name, city.country, city.latitude.toFixed(3), city.longitude.toFixed(3)]);
}

function pairId(locationA: City, locationB: City) {
  return [cityId(locationA), cityId(locationB)].sort().join(":");
}

function buildCityPairs(): CityPair[] {
  return WORLD_CITIES.flatMap((locationA, index) =>
    WORLD_CITIES.slice(index + 1).map((locationB) => ({
      id: pairId(locationA, locationB),
      locationA,
      locationB
    }))
  );
}

function landmarkId(landmark: Landmark) {
  return createUniqueContentKey("landmark", "id", [
    landmark.name,
    landmark.city,
    landmark.country,
    landmark.latitude.toFixed(4),
    landmark.longitude.toFixed(4)
  ]);
}

function verifiedLandmarkImage(landmark: Landmark) {
  return Boolean(landmark.imageUrl && !/blank|placeholder|\.svg/i.test(landmark.imageUrl));
}

export type MeetMeHalfwayPuzzle = ReturnType<typeof buildMeetMeHalfwayPuzzle>;
export type LandmarkDropPuzzle = ReturnType<typeof buildLandmarkDropPuzzle>;

function buildMeetMeHalfwayPuzzle(date: string, pair: CityPair, diagnostics: ContentUniverseDiagnostics) {
  const masterSeed = getDailyMasterSeed(date);
  const seed = getGameSeedForDate(date, "meet-me-halfway");
  const { locationA, locationB } = pair;
  const sphericalMidpoint = calculateGeographicMidpoint(locationA, locationB);
  const projectedMidpoint = calculateProjectedMidpoint(locationA, locationB);
  const uniqueContentKey = createUniqueContentKey("meet-me-halfway", "pair", [pair.id]);
  const antimeridianAdjusted = Math.abs(locationA.longitude - locationB.longitude) > 180;
  return {
    gameId: "meet-me-halfway" as const,
    gameVersion: "v2",
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
    antimeridianAdjusted,
    uniqueContentKey,
    duplicateCheck: {
      uniqueContentKey,
      duplicateDetected: false,
      passed: true,
      regenerationCount: 0,
      retryCount: 0,
      exhaustedCandidatePool: diagnostics.exhaustionLevel === "exhausted",
      checkedAgainstCount: diagnostics.dynamoDbReadCount,
      recentlyUsedKeys: [],
      warning: diagnostics.warnings.join(" ") || undefined
    },
    contentUniverse: diagnostics,
    contentHash: contentHashFromKey(uniqueContentKey),
    generatedAt: `${date}T12:00:00.000Z`
  };
}

function buildLandmarkDropPuzzle(date: string, landmark: Landmark, diagnostics: ContentUniverseDiagnostics) {
  const masterSeed = getDailyMasterSeed(date);
  const seed = getGameSeedForDate(date, "landmark-drop");
  const uniqueContentKey = createUniqueContentKey("landmark-drop", "landmark", [landmarkId(landmark)]);
  return {
    gameId: "landmark-drop" as const,
    gameVersion: "v2",
    date,
    masterSeed,
    gameSeed: seed,
    seed,
    landmark,
    uniqueContentKey,
    duplicateCheck: {
      uniqueContentKey,
      duplicateDetected: false,
      passed: true,
      regenerationCount: 0,
      retryCount: 0,
      exhaustedCandidatePool: diagnostics.exhaustionLevel === "exhausted",
      checkedAgainstCount: diagnostics.dynamoDbReadCount,
      recentlyUsedKeys: [],
      warning: diagnostics.warnings.join(" ") || undefined
    },
    contentUniverse: diagnostics,
    contentHash: contentHashFromKey(uniqueContentKey),
    generatedAt: `${date}T12:00:00.000Z`
  };
}

export async function resolveMeetMeHalfwayForDate(date: string): Promise<MeetMeHalfwayPuzzle> {
  const persisted = await getPersistedPuzzle<MeetMeHalfwayPuzzle>("meet-me-halfway", date);
  if (persisted) return { ...persisted, cacheHit: true } as MeetMeHalfwayPuzzle;
  const seed = String(getGameSeedForDate(date, "meet-me-halfway"));
  const universe = {
    getAllCandidates: buildCityPairs,
    getCandidateId: (pair: CityPair) => pair.id,
    getHardKeys: (pair: CityPair) => [createUniqueContentKey("meet-me-halfway", "pair", [pair.id])],
    getSoftKeys: (pair: CityPair) => [
      createUniqueContentKey("meet-me-halfway", "city-soft", [cityId(pair.locationA)]),
      createUniqueContentKey("meet-me-halfway", "city-soft", [cityId(pair.locationB)])
    ],
    validateCandidate: (pair: CityPair) => {
      const distance = haversineDistanceKm(pair.locationA, pair.locationB);
      const latitudeGap = Math.abs(pair.locationA.latitude - pair.locationB.latitude);
      const longitudeGap = Math.abs(pair.locationA.longitude - pair.locationB.longitude);
      return {
        valid: distance >= 1800 && distance <= 16000 && latitudeGap >= 4 && longitudeGap >= 25,
        reason: "Distance and visual-map separation check"
      };
    },
    selectCandidate: seededUniverseSelector<CityPair>((pair) => pair.id)
  };
  const { selected, diagnostics } = await selectFromContentUniverse({
    universe,
    gameSeed: seed,
    contentSource: "enumerated-world-city-pairs",
    softCooldownLabel: "recent city cooldown",
    dateKey: date,
    cooldownDays: CONTENT_INVENTORY_POLICY["meet-me-halfway"].cooldownDays,
    batchSizes: [160, 400, 1000]
  });
  if (!selected) throw new Error("Meet Me Halfway has no eligible city pairs after duplicate filtering.");
  const puzzle = buildMeetMeHalfwayPuzzle(date, selected, diagnostics);
  const published = await publishDailyPuzzleWithUsedContent({
    gameId: "meet-me-halfway",
    dateKey: date,
    puzzle,
    contentHash: puzzle.contentHash,
    usedContentRecords: [
      createUsedContentRecord({
        gameId: "meet-me-halfway",
        date,
        contentType: "location-pair",
        prompt: `${selected.locationA.name} to ${selected.locationB.name}`,
        answer: `${puzzle.midpoint.latitude},${puzzle.midpoint.longitude}`,
        uniqueContentKey: puzzle.uniqueContentKey,
        sourceMetadata: { source: "enumerated-world-city-pairs", contentUniverse: diagnostics }
      }),
      ...[selected.locationA, selected.locationB].map((city) => createUsedContentRecord({
        gameId: "meet-me-halfway",
        date,
        contentType: "semantic-city-cooldown",
        prompt: city.name,
        answer: city.country,
        uniqueContentKey: createUniqueContentKey("meet-me-halfway", "city-soft", [cityId(city)]),
        sourceMetadata: { source: "enumerated-world-city-pairs", cooldownDays: CONTENT_INVENTORY_POLICY["meet-me-halfway"].cooldownDays }
      }))
    ]
  });
  return published.puzzle;
}

export async function resolveLandmarkDropForDate(date: string): Promise<LandmarkDropPuzzle> {
  const persisted = await getPersistedPuzzle<LandmarkDropPuzzle>("landmark-drop", date);
  if (persisted) return { ...persisted, cacheHit: true } as LandmarkDropPuzzle;
  const seed = String(getGameSeedForDate(date, "landmark-drop"));
  let landmarkCandidates = await getAllLandmarkCandidates();
  const usage = await getInventoryUsageCounts(["landmark-drop"]);
  if (landmarkCandidates.length - (usage.get("landmark-drop") ?? 0) < CONTENT_INVENTORY_POLICY["landmark-drop"].replenishBelow) {
    const replenished = await replenishLandmarkCandidates(`${date}:${seed}`, CONTENT_INVENTORY_POLICY["landmark-drop"].batchSize).catch(() => null);
    if (replenished?.validated) landmarkCandidates = await getAllLandmarkCandidates();
  }
  const universe = {
    getAllCandidates: () => landmarkCandidates,
    getCandidateId: landmarkId,
    getHardKeys: (landmark: Landmark) => [createUniqueContentKey("landmark-drop", "landmark", [landmarkId(landmark)])],
    getSoftKeys: (landmark: Landmark) => [
      createUniqueContentKey("landmark-drop", "country-soft", [landmark.country]),
      createUniqueContentKey("landmark-drop", "category-soft", [landmark.category ?? "landmark"])
    ],
    validateCandidate: (landmark: Landmark) => ({
      valid: Number.isFinite(landmark.latitude) && Number.isFinite(landmark.longitude) && verifiedLandmarkImage(landmark),
      reason: "Coordinates and verified photograph URL required"
    }),
    selectCandidate: seededUniverseSelector<Landmark>(landmarkId)
  };
  const { selected, diagnostics } = await selectFromContentUniverse({
    universe,
    gameSeed: seed,
    contentSource: "verified-landmark-photograph-catalog",
    softCooldownLabel: "recent country/category cooldown",
    dateKey: date,
    cooldownDays: CONTENT_INVENTORY_POLICY["landmark-drop"].cooldownDays,
    batchSizes: [150, 350, 500]
  });
  if (!selected) throw new Error("On a Postcard has no eligible verified landmark photographs after duplicate filtering.");
  const puzzle = buildLandmarkDropPuzzle(date, selected, diagnostics);
  const published = await publishDailyPuzzleWithUsedContent({
    gameId: "landmark-drop",
    dateKey: date,
    puzzle,
    contentHash: puzzle.contentHash,
    usedContentRecords: [
      createUsedContentRecord({
        gameId: "landmark-drop",
        date,
        contentType: "landmark",
        prompt: selected.name,
        answer: `${selected.name}, ${selected.city}, ${selected.country}`,
        uniqueContentKey: puzzle.uniqueContentKey,
        sourceMetadata: { source: "verified-landmark-photograph-catalog", imageUrl: selected.imageUrl, contentUniverse: diagnostics }
      }),
      createUsedContentRecord({
        gameId: "landmark-drop", date, contentType: "semantic-country-cooldown",
        prompt: selected.country, answer: selected.country,
        uniqueContentKey: createUniqueContentKey("landmark-drop", "country-soft", [selected.country]),
        sourceMetadata: { source: "verified-landmark-photograph-catalog", cooldownDays: CONTENT_INVENTORY_POLICY["landmark-drop"].cooldownDays }
      }),
      createUsedContentRecord({
        gameId: "landmark-drop", date, contentType: "semantic-category-cooldown",
        prompt: selected.category, answer: selected.category,
        uniqueContentKey: createUniqueContentKey("landmark-drop", "category-soft", [selected.category]),
        sourceMetadata: { source: "verified-landmark-photograph-catalog", cooldownDays: CONTENT_INVENTORY_POLICY["landmark-drop"].cooldownDays }
      })
    ]
  });
  return published.puzzle;
}
