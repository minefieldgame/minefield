import "server-only";

import { WORLD_CITIES } from "@/data/worldCities";
import { BALLPARK_CANDIDATES, BUZZWORD_CANDIDATES, IN_ORDER_CANDIDATES, validateBuzzwordCandidate, validateNumericCandidate, validateObjectiveOrdering } from "@/lib/content/preparedInventories";
import { classifyInventoryHealth, CONTENT_INVENTORY_POLICY, type InventoryGameId } from "@/lib/content/inventoryPolicy";
import { getInventoryUsageCounts, getPersistedCandidateInventory } from "@/lib/content/persistence";
import { getValidatedSingAlongCandidates } from "@/lib/content/singAlongInventory";
import { getAllLandmarkCandidates } from "@/lib/content/landmarkInventory";

export type InventoryOverview = {
  gameId: InventoryGameId;
  label: string;
  generationArchitecture: string;
  totalCandidateInventory: number;
  validatedInventory: number;
  unusedInventory: number;
  invalidCandidates: number;
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
};

export async function getInventoryOverview(): Promise<InventoryOverview[]> {
  const [singCandidates, singPersisted, usageCounts, orderPersisted, wordPersisted, numericPersisted, landmarkCandidates] = await Promise.all([
    getValidatedSingAlongCandidates(),
    getPersistedCandidateInventory("sing-along"),
    getInventoryUsageCounts(Object.keys(CONTENT_INVENTORY_POLICY)),
    getPersistedCandidateInventory("ranked-top-5"),
    getPersistedCandidateInventory("spelldrop"),
    getPersistedCandidateInventory("closer"),
    getAllLandmarkCandidates()
  ]);
  const validatedPersisted = (records: Array<{ validationStatus: string }>) => records.filter((record) => record.validationStatus === "validated").length;
  const base: Array<Omit<InventoryOverview,
    "label" | "target" | "replenishBelow" | "cooldownDays" | "healthStatus" |
    "exactDuplicatesUsed" | "candidatesOnCooldown" | "candidatesGeneratedCurrentRequest" |
    "candidatesRejectedCurrentRequest" | "selectedCandidate" | "generationDurationMs" |
    "apiCalls" | "dynamoDbReads" | "dynamoDbWrites" | "finalStatus" | "actionableFailureReason"
  >> = [
    { gameId: "needledrop", generationArchitecture: "Multi-issue Billboard discovery → batch duplicate check → bounded iTunes preview validation", totalCandidateInventory: 6800, validatedInventory: 6800, unusedInventory: 6800, invalidCandidates: 0, pendingReview: 0, sourceStrategy: "Billboard issues across decades and positions; iTunes original-recording previews" },
    { gameId: "sing-along", generationArchitecture: "Persisted reviewed timing pool → preview validation → staged discovery/review queue", totalCandidateInventory: singCandidates.length + singPersisted.filter((record) => record.validationStatus !== "validated").length, validatedInventory: singCandidates.length, unusedInventory: singCandidates.length, invalidCandidates: singPersisted.filter((record) => record.validationStatus === "invalid").length, pendingReview: singPersisted.filter((record) => record.validationStatus === "pending-review").length, sourceStrategy: "Reviewed lyric timing metadata; iTunes discovery; no unreviewed lyric fallback" },
    { gameId: "ranked-top-5", generationArchitecture: "Structured country-fact taxonomy → objective five-item combinations → model-assisted replenishment", totalCandidateInventory: IN_ORDER_CANDIDATES.length + orderPersisted.length, validatedInventory: IN_ORDER_CANDIDATES.filter(validateObjectiveOrdering).length + validatedPersisted(orderPersisted), unusedInventory: IN_ORDER_CANDIDATES.filter(validateObjectiveOrdering).length + validatedPersisted(orderPersisted), invalidCandidates: IN_ORDER_CANDIDATES.filter((item) => !validateObjectiveOrdering(item)).length + orderPersisted.filter((item) => item.validationStatus === "invalid").length, pendingReview: orderPersisted.filter((item) => item.validationStatus === "pending-review").length, sourceStrategy: "REST Countries/World Bank snapshot plus reusable topic generator" },
    { gameId: "spelldrop", generationArchitecture: "Frequency-ranked lexical inventory → definition/pronunciation/misspelling validation", totalCandidateInventory: BUZZWORD_CANDIDATES.length + wordPersisted.length, validatedInventory: BUZZWORD_CANDIDATES.filter(validateBuzzwordCandidate).length + validatedPersisted(wordPersisted), unusedInventory: BUZZWORD_CANDIDATES.filter(validateBuzzwordCandidate).length + validatedPersisted(wordPersisted), invalidCandidates: BUZZWORD_CANDIDATES.filter((item) => !validateBuzzwordCandidate(item)).length + wordPersisted.filter((item) => item.validationStatus === "invalid").length, pendingReview: wordPersisted.filter((item) => item.validationStatus === "pending-review").length, sourceStrategy: "WordNet + SUBTLEX-US + CMUdict; structured model batches below threshold" },
    { gameId: "closer", generationArchitecture: "Structured fact taxonomy → numeric/unit validation → balanced deterministic selection", totalCandidateInventory: BALLPARK_CANDIDATES.length + numericPersisted.length, validatedInventory: BALLPARK_CANDIDATES.filter(validateNumericCandidate).length + validatedPersisted(numericPersisted), unusedInventory: BALLPARK_CANDIDATES.filter(validateNumericCandidate).length + validatedPersisted(numericPersisted), invalidCandidates: BALLPARK_CANDIDATES.filter((item) => !validateNumericCandidate(item)).length + numericPersisted.filter((item) => item.validationStatus === "invalid").length, pendingReview: numericPersisted.filter((item) => item.validationStatus === "pending-review").length, sourceStrategy: "REST Countries + World Bank snapshot; verified batch replenishment" },
    { gameId: "landmark-drop", generationArchitecture: "Wikidata discovery → Commons MIME/dimension/license validation → prepared photo manifest", totalCandidateInventory: landmarkCandidates.length, validatedInventory: landmarkCandidates.length, unusedInventory: landmarkCandidates.length, invalidCandidates: 0, pendingReview: 0, sourceStrategy: "Wikidata/Wikimedia Commons ingestion and maintenance script" },
    { gameId: "meet-me-halfway", generationArchitecture: "Enumerated city pairs → geometric validation → bounded duplicate batch", totalCandidateInventory: WORLD_CITIES.length * (WORLD_CITIES.length - 1) / 2, validatedInventory: WORLD_CITIES.length * (WORLD_CITIES.length - 1) / 2, unusedInventory: WORLD_CITIES.length * (WORLD_CITIES.length - 1) / 2, invalidCandidates: 0, pendingReview: 0, sourceStrategy: "Prepared world-city coordinates and projected-midpoint validation" }
  ];
  return base.map((row) => {
    const policy = CONTENT_INVENTORY_POLICY[row.gameId];
    const unusedInventory = Math.max(0, row.validatedInventory - (usageCounts.get(row.gameId) ?? 0));
    const healthStatus = classifyInventoryHealth(row.validatedInventory, unusedInventory, policy.target);
    return {
      ...row, unusedInventory, label: policy.label, target: policy.target, replenishBelow: policy.replenishBelow,
      cooldownDays: policy.cooldownDays, healthStatus,
      exactDuplicatesUsed: usageCounts.get(row.gameId) ?? 0,
      candidatesOnCooldown: 0,
      candidatesGeneratedCurrentRequest: 0,
      candidatesRejectedCurrentRequest: 0,
      selectedCandidate: "",
      generationDurationMs: 0,
      apiCalls: 0,
      dynamoDbReads: 1,
      dynamoDbWrites: 0,
      finalStatus: healthStatus,
      actionableFailureReason: ""
    };
  });
}
