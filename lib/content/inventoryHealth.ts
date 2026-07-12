import "server-only";

import { LANDMARKS } from "@/data/landmarks";
import { WORLD_CITIES } from "@/data/worldCities";
import { haversineDistanceKm } from "@/games/geography/logic";
import {
  BALLPARK_CANDIDATES,
  BUZZWORD_CANDIDATES,
  IN_ORDER_CANDIDATES,
  validateBuzzwordCandidate,
  validateNumericCandidate,
  validateObjectiveOrdering,
  type BuzzwordCandidate,
  type InOrderCandidate,
  type NumericCandidate
} from "@/lib/content/preparedInventories";
import { ODD_ONE_OUT_INVENTORY } from "@/lib/content/oddOneOutInventory";
import { classifyInventoryHealth, CONTENT_INVENTORY_POLICY, type InventoryGameId } from "@/lib/content/inventoryPolicy";
import { buildInventoryMetrics, type InventoryMetrics } from "@/lib/content/inventoryMetrics";
import { getInventoryUsageCounts, getPersistedCandidateInventory } from "@/lib/content/persistence";
import { getAllLandmarkCandidates } from "@/lib/content/landmarkInventory";
import { isLandmarkEligible } from "@/lib/content/landmarkQuality";
import { getLatestRewindInventorySnapshot } from "@/lib/needledropResolver";

export type InventoryOverview = {
  gameId: InventoryGameId;
  active: true;
  label: string;
  generationArchitecture: string;
  metrics: InventoryMetrics;
  metricDefinitionsVersion: "inventory-metrics-v1";
  totalCandidateInventory: number;
  validatedInventory: number;
  qualityApprovedInventory: number;
  playableInventory: number;
  unusedInventory: number;
  invalidCandidates: number;
  rejectedQuality: number;
  pendingReview: number;
  target: number;
  replenishBelow: number;
  cooldownDays: number;
  healthStatus: ReturnType<typeof classifyInventoryHealth>;
  sourceStrategy: string;
  exactDuplicatesUsed: number;
  candidatesOnCooldown: number;
  candidatesGeneratedCurrentRequest: number;
  candidatesRejectedCurrentRequest: number;
  selectedCandidate: string;
  generationDurationMs: number;
  apiCalls: number;
  dynamoDbReads: number;
  dynamoDbWrites: number;
  finalStatus: string;
  actionableFailureReason: string;
  metricsScope: string;
  distributions: Record<string, Record<string, number>>;
};

function uniqueMerged<T>(prepared: readonly T[], persisted: Array<{ candidateId: string; payload: T; validationStatus: string }>, id: (candidate: T) => string, validate: (candidate: T) => boolean) {
  return [...new Map([
    ...prepared.filter(validate).map((candidate) => [id(candidate), candidate] as const),
    ...persisted.filter((record) => record.validationStatus === "validated" && validate(record.payload)).map((record) => [id(record.payload), record.payload] as const)
  ]).values()];
}

function distribution<T>(items: readonly T[], key: (item: T) => string) {
  const result: Record<string, number> = {};
  for (const item of items) result[key(item)] = (result[key(item)] ?? 0) + 1;
  return result;
}

function cityPairCounts() {
  let discovered = 0;
  let eligible = 0;
  for (let left = 0; left < WORLD_CITIES.length; left += 1) {
    for (let right = left + 1; right < WORLD_CITIES.length; right += 1) {
      discovered += 1;
      const a = WORLD_CITIES[left];
      const b = WORLD_CITIES[right];
      const distance = haversineDistanceKm(a, b);
      if (distance >= 1800 && distance <= 16000 && Math.abs(a.latitude - b.latitude) >= 4 && Math.abs(a.longitude - b.longitude) >= 25) eligible += 1;
    }
  }
  return { discovered, eligible };
}

function overview({
  gameId,
  metrics,
  generationArchitecture,
  sourceStrategy,
  usageCount,
  metricsScope,
  distributions = {},
  healthOverride
}: {
  gameId: InventoryGameId;
  metrics: InventoryMetrics;
  generationArchitecture: string;
  sourceStrategy: string;
  usageCount: number;
  metricsScope: string;
  distributions?: Record<string, Record<string, number>>;
  healthOverride?: ReturnType<typeof classifyInventoryHealth>;
}): InventoryOverview {
  const policy = CONTENT_INVENTORY_POLICY[gameId];
  const healthStatus = healthOverride ?? classifyInventoryHealth(metrics.playableEligible, metrics.unusedEligible, policy.target);
  return {
    gameId,
    active: true,
    label: policy.label,
    generationArchitecture,
    metrics,
    metricDefinitionsVersion: "inventory-metrics-v1",
    totalCandidateInventory: metrics.discoveredUnique,
    validatedInventory: metrics.technicallyValidUnique,
    qualityApprovedInventory: metrics.qualityApproved,
    playableInventory: metrics.playableEligible,
    unusedInventory: metrics.unusedEligible,
    invalidCandidates: metrics.invalid,
    rejectedQuality: metrics.rejectedQuality,
    pendingReview: metrics.pendingExternalProviderData,
    target: policy.target,
    replenishBelow: policy.replenishBelow,
    cooldownDays: policy.cooldownDays,
    healthStatus,
    sourceStrategy,
    exactDuplicatesUsed: usageCount,
    candidatesOnCooldown: metrics.cooldown,
    candidatesGeneratedCurrentRequest: 0,
    candidatesRejectedCurrentRequest: 0,
    selectedCandidate: "",
    generationDurationMs: 0,
    apiCalls: 0,
    dynamoDbReads: 1,
    dynamoDbWrites: 0,
    finalStatus: healthStatus,
    actionableFailureReason: "",
    metricsScope,
    distributions
  };
}

export async function getInventoryOverview(): Promise<InventoryOverview[]> {
  const [usageCounts, orderPersisted, wordPersisted, numericPersisted, landmarkPersisted, allLandmarks] = await Promise.all([
    getInventoryUsageCounts(Object.keys(CONTENT_INVENTORY_POLICY)),
    getPersistedCandidateInventory<InOrderCandidate>("ranked-top-5"),
    getPersistedCandidateInventory<BuzzwordCandidate>("spelldrop"),
    getPersistedCandidateInventory<NumericCandidate>("closer"),
    getPersistedCandidateInventory("landmark-drop"),
    getAllLandmarkCandidates()
  ]);
  const used = (gameId: InventoryGameId) => usageCounts.get(gameId) ?? 0;
  const unused = (eligible: number, gameId: InventoryGameId) => Math.max(0, eligible - Math.min(eligible, used(gameId)));

  const rewindSnapshot = getLatestRewindInventorySnapshot();
  const rewind = rewindSnapshot?.metrics;
  const rewindMetrics = buildInventoryMetrics({
    discoveredUnique: rewind?.discoveredUniqueTracks ?? 0,
    providerResponsesExamined: rewind?.providerResponsesExamined ?? 0,
    technicallyValidUnique: rewind?.metadataValidUniqueTracks ?? 0,
    qualityApproved: rewind?.qualityApprovedUniqueTracks ?? 0,
    playableEligible: rewind?.qualityApprovedUniqueTracks ?? 0,
    previouslyUsed: rewind?.previouslyUsedUniqueTracks ?? used("needledrop"),
    unusedEligible: rewind?.unusedEligibleUniqueTracks ?? 0,
    invalid: rewind?.rejectedProviderResponses ?? 0,
    rejectedQuality: Math.max(0, (rewind?.metadataValidUniqueTracks ?? 0) - (rewind?.qualityApprovedUniqueTracks ?? 0)),
    duplicateAliasesCollapsed: rewind?.duplicateAliasesCollapsed ?? 0
  });

  const orderCandidates = uniqueMerged(IN_ORDER_CANDIDATES, orderPersisted, (candidate) => candidate.id, validateObjectiveOrdering);
  const wordCandidates = uniqueMerged(BUZZWORD_CANDIDATES, wordPersisted, (candidate) => candidate.id, validateBuzzwordCandidate);
  const numericCandidates = uniqueMerged(BALLPARK_CANDIDATES, numericPersisted, (candidate) => candidate.id, validateNumericCandidate);
  const preparedWordTechnical = BUZZWORD_CANDIDATES.filter((candidate) => candidate.pronunciationValid && candidate.misspellingValid).length;
  const wordTechnical = Math.max(preparedWordTechnical, wordCandidates.length);
  const landmarkTechnical = allLandmarks.length;
  const landmarkEligible = allLandmarks.filter(isLandmarkEligible);
  const pairCounts = cityPairCounts();

  const rows: InventoryOverview[] = [
    overview({
      gameId: "needledrop",
      metrics: rewindMetrics,
      generationArchitecture: "Same-week historical Billboard issues -> recognizability gate -> bounded iTunes original-preview validation",
      sourceStrategy: "Billboard issues anchored to the selected month/day across prior years; iTunes original-recording previews",
      usageCount: used("needledrop"),
      metricsScope: rewindSnapshot ? `Bounded selected-date discovery snapshot for ${rewindSnapshot.date}.` : "Not materialized on this warm instance; generate a selected-date preview to populate bounded provider metrics.",
      distributions: { recognizabilityTier: rewindSnapshot?.tierDistribution ?? { iconic: 0, mainstream: 0, challenging: 0, reject: 0 } },
      healthOverride: rewindSnapshot ? undefined : "Low eligible inventory"
    }),
    overview({
      gameId: "odd-one-out",
      metrics: buildInventoryMetrics({
        discoveredUnique: ODD_ONE_OUT_INVENTORY.totalCandidates,
        technicallyValidUnique: ODD_ONE_OUT_INVENTORY.eligibleCount,
        qualityApproved: ODD_ONE_OUT_INVENTORY.eligibleCount,
        playableEligible: ODD_ONE_OUT_INVENTORY.eligibleCount,
        previouslyUsed: used("odd-one-out"),
        unusedEligible: unused(ODD_ONE_OUT_INVENTORY.eligibleCount, "odd-one-out"),
        rejectedQuality: ODD_ONE_OUT_INVENTORY.rejectedCount
      }),
      generationArchitecture: "Project-authored source-backed templates -> ambiguity/quality validation -> balanced deterministic category selection",
      sourceStrategy: "Open factual references and project-authored original mechanics; no copyrighted passages",
      usageCount: used("odd-one-out"),
      metricsScope: "Complete prepared Odd One Out inventory.",
      distributions: { categoryFamily: ODD_ONE_OUT_INVENTORY.categoryDistribution, difficultyTier: ODD_ONE_OUT_INVENTORY.difficultyDistribution }
    }),
    overview({
      gameId: "ranked-top-5",
      metrics: buildInventoryMetrics({
        discoveredUnique: orderCandidates.length + orderPersisted.filter((record) => record.validationStatus !== "validated").length,
        technicallyValidUnique: orderCandidates.length,
        qualityApproved: orderCandidates.length,
        playableEligible: orderCandidates.length,
        previouslyUsed: used("ranked-top-5"),
        unusedEligible: unused(orderCandidates.length, "ranked-top-5"),
        pendingExternalProviderData: orderPersisted.filter((record) => record.validationStatus === "pending-review").length,
        invalid: orderPersisted.filter((record) => record.validationStatus === "invalid").length
      }),
      generationArchitecture: "Source-backed reference collections -> objective ordering/familiarity/quality gates -> balanced family selection",
      sourceStrategy: "Versioned mainstream film, music, games, books, history, science, sports, landmark, technology, and geography references",
      usageCount: used("ranked-top-5"),
      metricsScope: "Prepared plus current-version validated persisted candidates.",
      distributions: { categoryFamily: distribution(orderCandidates, (candidate) => candidate.categoryFamily), difficultyTier: distribution(orderCandidates, (candidate) => candidate.difficultyTier) }
    }),
    overview({
      gameId: "spelldrop",
      metrics: buildInventoryMetrics({
        discoveredUnique: wordTechnical + wordPersisted.filter((record) => record.validationStatus !== "validated").length,
        technicallyValidUnique: wordTechnical,
        qualityApproved: wordCandidates.length,
        playableEligible: wordCandidates.length,
        previouslyUsed: used("spelldrop"),
        unusedEligible: unused(wordCandidates.length, "spelldrop"),
        pendingExternalProviderData: wordPersisted.filter((record) => record.validationStatus === "pending-review").length,
        invalid: BUZZWORD_CANDIDATES.length - wordTechnical + wordPersisted.filter((record) => record.validationStatus === "invalid").length,
        rejectedQuality: Math.max(0, wordTechnical - wordCandidates.length)
      }),
      generationArchitecture: "WordNet/SUBTLEX/CMUdict -> readable syllables -> evidence-scored human misspellings -> lexical quality gate",
      sourceStrategy: "Princeton WordNet, SUBTLEX-US, and CMUdict",
      usageCount: used("spelldrop"),
      metricsScope: "Complete prepared lexical inventory plus current-version validated persisted candidates.",
      distributions: { difficulty: distribution(wordCandidates, (candidate) => candidate.difficulty) }
    }),
    overview({
      gameId: "closer",
      metrics: buildInventoryMetrics({
        discoveredUnique: numericCandidates.length + numericPersisted.filter((record) => record.validationStatus !== "validated").length,
        technicallyValidUnique: numericCandidates.length,
        qualityApproved: numericCandidates.length,
        playableEligible: numericCandidates.length,
        previouslyUsed: used("closer"),
        unusedEligible: unused(numericCandidates.length, "closer"),
        pendingExternalProviderData: numericPersisted.filter((record) => record.validationStatus === "pending-review").length,
        invalid: numericPersisted.filter((record) => record.validationStatus === "invalid").length
      }),
      generationArchitecture: "Source-backed stable numeric references -> funness/grammar/unit/quality gates -> balanced category selection",
      sourceStrategy: "Versioned mainstream landmark, sports, entertainment, astronomy, animal, geography, transport, body, technology, and history references",
      usageCount: used("closer"),
      metricsScope: "Prepared plus current-version validated persisted candidates.",
      distributions: { category: distribution(numericCandidates, (candidate) => candidate.category), difficultyTier: distribution(numericCandidates, (candidate) => candidate.difficultyTier) }
    }),
    overview({
      gameId: "meet-me-halfway",
      metrics: buildInventoryMetrics({
        discoveredUnique: pairCounts.discovered,
        technicallyValidUnique: pairCounts.eligible,
        qualityApproved: pairCounts.eligible,
        playableEligible: pairCounts.eligible,
        previouslyUsed: used("meet-me-halfway"),
        unusedEligible: unused(pairCounts.eligible, "meet-me-halfway")
      }),
      generationArchitecture: "Enumerated city pairs -> geometric separation validation -> bounded duplicate batches",
      sourceStrategy: "Prepared world-city coordinates and projected midpoint validation",
      usageCount: used("meet-me-halfway"),
      metricsScope: "Complete enumerated city-pair universe."
    }),
    overview({
      gameId: "landmark-drop",
      metrics: buildInventoryMetrics({
        discoveredUnique: allLandmarks.length + landmarkPersisted.filter((record) => record.validationStatus !== "validated").length,
        technicallyValidUnique: landmarkTechnical,
        qualityApproved: landmarkEligible.length,
        playableEligible: landmarkEligible.length,
        previouslyUsed: used("landmark-drop"),
        unusedEligible: unused(landmarkEligible.length, "landmark-drop"),
        pendingExternalProviderData: landmarkPersisted.filter((record) => record.validationStatus === "pending-review").length,
        invalid: landmarkPersisted.filter((record) => record.validationStatus === "invalid").length,
        rejectedQuality: Math.max(0, landmarkTechnical - landmarkEligible.length)
      }),
      generationArchitecture: "Wikidata/Commons media validation -> extant-site/image/playability gate -> recognizability-tier selection",
      sourceStrategy: "Wikidata identities and coordinates plus licensed Wikimedia Commons photographs",
      usageCount: used("landmark-drop"),
      metricsScope: "Prepared technical catalog plus current-version eligible persisted candidates.",
      distributions: {
        recognizabilityTier: distribution(allLandmarks, (landmark) => landmark.recognizabilityTier),
        region: distribution(landmarkEligible, (landmark) => landmark.region),
        category: distribution(landmarkEligible, (landmark) => landmark.category)
      }
    })
  ];
  return rows;
}
