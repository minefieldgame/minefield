import assert from "node:assert/strict";
import { LANDMARKS } from "../data/landmarks";
import { SING_ALONG_CATALOG } from "../data/singAlongCatalog";
import { validateSingAlongTimingCandidate } from "../lib/content/candidateValidation";
import { isLandmarkEligible } from "../lib/content/landmarkQuality";
import {
  ODD_ONE_OUT_INVENTORY,
  validateOddOneOutCandidate
} from "../lib/content/oddOneOutInventory";
import {
  BALLPARK_CANDIDATES,
  BUZZWORD_CANDIDATES,
  IN_ORDER_CANDIDATES,
  validateBallparkInventoryDistribution,
  validateBuzzwordCandidate,
  validateInOrderInventoryDistribution,
  validateNumericCandidate,
  validateObjectiveOrdering
} from "../lib/content/preparedInventories";
import { ACTIVE_GAME_IDS, PRELIMINARY_GAME_IDS } from "../lib/gameDisplay";
import { createMusicUsedContentKey, createUniqueContentKey, normalizeUsedContentText } from "../lib/content/usedContentRegistry";
import { ALL_VAULTBREAK_CODES, generateVaultbreakPuzzle, solveVaultbreak } from "../games/vaultbreak/logic";

function unique(values: string[], label: string) {
  assert.equal(new Set(values).size, values.length, `${label} contains duplicate normalized keys`);
}

function distribution<T>(items: readonly T[], getValue: (item: T) => string) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = getValue(item);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

const eligibleBuzzwords = BUZZWORD_CANDIDATES.filter(validateBuzzwordCandidate);
assert.equal(ALL_VAULTBREAK_CODES.length, 5_040, "Vaultbreak must enumerate the full no-repeat four-digit code space");
for (const difficulty of ["approachable", "standard", "hard"] as const) {
  const puzzle = generateVaultbreakPuzzle(`inventory-validation-${difficulty}`, difficulty);
  assert.deepEqual(solveVaultbreak(puzzle.clues), [puzzle.secretCode], `${difficulty} Vaultbreak puzzle must have one solution`);
}
assert.ok(BUZZWORD_CANDIDATES.length >= 5_000, "Buzzword needs at least 5,000 prepared records");
assert.ok(eligibleBuzzwords.length >= 4_000, "Buzzword needs at least 4,000 fully quality-approved records");
unique(BUZZWORD_CANDIDATES.map((item) => normalizeUsedContentText(item.word)), "Buzzword inventory");
unique(eligibleBuzzwords.map((item) => createUniqueContentKey("spelldrop", "definition", [item.definition])), "Eligible Buzzword definitions");
assert.ok(eligibleBuzzwords.every((item) => !/\d|\b[A-Z]{1,3}\d\b/.test(item.pronunciationHint)), "Buzzword hints must not expose raw phoneme notation");
assert.ok(eligibleBuzzwords.every((item) => item.misspellingEvidence.length === item.commonMisspellings.length), "Every eligible misspelling needs plausibility evidence");

const ballparkDistribution = validateBallparkInventoryDistribution(BALLPARK_CANDIDATES);
assert.ok(BALLPARK_CANDIDATES.length >= 500, "Ballpark needs at least 500 quality-approved questions");
assert.ok(BALLPARK_CANDIDATES.every(validateNumericCandidate));
assert.equal(ballparkDistribution.valid, true, ballparkDistribution.errors.join(" | "));
unique(BALLPARK_CANDIDATES.map((item) => createUniqueContentKey("closer", "question-answer", [item.prompt, item.answer, item.unit])), "Ballpark question/answer identities");
assert.ok(BALLPARK_CANDIDATES.every((item) => item.qualityApproved && item.qualityScore >= 72));
assert.ok(BALLPARK_CANDIDATES.every((item) => !/snapshot|structured[- ]data|indicator code|provider name|database|api response/i.test(item.prompt)));
assert.ok(BALLPARK_CANDIDATES.every((item) => !/official (?:currenc|language).*(?:listed|recorded)|\b1 (?:currencies|official languages)\b/i.test(`${item.prompt} ${item.displayAnswer}`)));

const inOrderDistribution = validateInOrderInventoryDistribution(IN_ORDER_CANDIDATES);
assert.ok(IN_ORDER_CANDIDATES.length >= 600, "In Order needs at least 600 quality-approved lists");
assert.ok(IN_ORDER_CANDIDATES.every(validateObjectiveOrdering));
assert.equal(inOrderDistribution.valid, true, inOrderDistribution.errors.join(" | "));
unique(IN_ORDER_CANDIDATES.map((item) => createUniqueContentKey("ranked-top-5", "ranking", [item.metric, item.direction, item.items.map(([name]) => name).sort().join("|")])), "In Order runtime ranking identities");
assert.ok(IN_ORDER_CANDIDATES.every((item) => !/latitude|longitude|snapshot|structured[- ]data|provider/i.test(`${item.metric} ${item.playerPrompt}`)));

assert.equal(ODD_ONE_OUT_INVENTORY.valid, true, ODD_ONE_OUT_INVENTORY.errors.join(" | "));
assert.ok(ODD_ONE_OUT_INVENTORY.eligibleCount >= 1_000, "Odd One Out needs at least 1,000 eligible candidates");
assert.ok(ODD_ONE_OUT_INVENTORY.eligibleCandidates.every((candidate) => validateOddOneOutCandidate(candidate).valid));
assert.ok(ODD_ONE_OUT_INVENTORY.meaningfulCategoryCount >= 10);
assert.ok(ODD_ONE_OUT_INVENTORY.maximumCategoryShare <= 0.2);
unique(ODD_ONE_OUT_INVENTORY.eligibleCandidates.map((candidate) => candidate.exactDuplicateKey), "Odd One Out item sets");

const eligibleLandmarks = LANDMARKS.filter(isLandmarkEligible);
const archiveLandmarks = LANDMARKS.filter((item) => item.eligibilityStatus === "archive-only");
assert.ok(LANDMARKS.length >= 500, "Postcard needs at least 500 technically reviewed records");
assert.ok(eligibleLandmarks.length >= 500, "Postcard needs at least 500 quality-approved eligible records");
unique(LANDMARKS.map((item) => item.id), "Landmark IDs");
unique(LANDMARKS.map((item) => normalizeUsedContentText(item.name)), "Landmark names");
unique(LANDMARKS.map((item) => item.imageFile.toLowerCase()), "Landmark source files");
unique(LANDMARKS.map((item) => `${item.latitude.toFixed(5)},${item.longitude.toFixed(5)}`), "Landmark coordinates");
assert.ok(LANDMARKS.every((item) => Number.isFinite(item.latitude) && Math.abs(item.latitude) <= 90 && Number.isFinite(item.longitude) && Math.abs(item.longitude) <= 180));
assert.ok(LANDMARKS.every((item) => item.mimeType.startsWith("image/") && item.mimeType !== "image/svg+xml" && item.width >= 640 && item.height >= 480 && item.attribution && item.license));
assert.ok(eligibleLandmarks.every((item) => item.qualityEvaluation.finalEligibility && item.recognizabilityTier !== "archive-only"));
assert.ok(archiveLandmarks.every((item) => !isLandmarkEligible(item) && item.recognizabilityTier === "archive-only" && item.exclusionReason));
assert.equal(LANDMARKS.find((item) => item.id === "Q656765")?.eligibilityStatus, "archive-only", "The demolished Babri Masjid record must remain archive-only");
assert.equal(LANDMARKS.find((item) => item.id === "Q234364")?.eligibilityStatus, "archive-only", "The demolished Tuileries Palace must remain archive-only");
assert.equal(LANDMARKS.find((item) => item.id === "Q202902")?.eligibilityStatus, "archive-only", "The destroyed Crystal Palace must remain archive-only");
assert.equal(LANDMARKS.find((item) => item.name === "Volksparkstadion")?.recognizabilityTier, "challenging", "Weak stadiums must be down-ranked from normal-quality tiers");

assert.ok(SING_ALONG_CATALOG.length > 0, "Legacy Sing Along records must remain readable");
assert.ok(SING_ALONG_CATALOG.every((item) => item.eligibilityState === "archive-only"), "Every Sing Along record must remain retired from active eligibility");
assert.ok(SING_ALONG_CATALOG.every((item) => validateSingAlongTimingCandidate(item).valid), "Retired Sing Along records must remain structurally safe for old puzzles");
unique(SING_ALONG_CATALOG.map((item) => createMusicUsedContentKey(item.artist, item.title)), "Legacy Sing Along songs");

assert.deepEqual(ACTIVE_GAME_IDS, [
  "needledrop",
  "odd-one-out",
  "vaultbreak",
  "ranked-top-5",
  "spelldrop",
  "closer",
  "meet-me-halfway",
  "landmark-drop",
  "minefield"
]);
assert.equal(ACTIVE_GAME_IDS.includes("sing-along" as never), false);
assert.deepEqual(PRELIMINARY_GAME_IDS, ACTIVE_GAME_IDS.filter((gameId) => gameId !== "minefield"));

const landmarkContinents = distribution(eligibleLandmarks, (item) => item.continent);
const landmarkCategories = distribution(eligibleLandmarks, (item) => item.category);
const landmarkTiers = distribution(LANDMARKS, (item) => item.recognizabilityTier);
assert.ok(Math.max(...Object.values(landmarkContinents)) < eligibleLandmarks.length * 0.5, "No continent may dominate half of eligible Postcard inventory");

console.log(JSON.stringify({
  activeGames: ACTIVE_GAME_IDS,
  buzzword: {
    prepared: BUZZWORD_CANDIDATES.length,
    fullyEligible: eligibleBuzzwords.length,
    rejectedByQuality: BUZZWORD_CANDIDATES.length - eligibleBuzzwords.length,
    difficulty: distribution(eligibleBuzzwords, (item) => item.difficulty)
  },
  ballpark: {
    eligible: BALLPARK_CANDIDATES.length,
    distribution: ballparkDistribution.counts
  },
  inOrder: {
    eligible: IN_ORDER_CANDIDATES.length,
    categoryFamilies: inOrderDistribution.counts
  },
  oddOneOut: {
    eligible: ODD_ONE_OUT_INVENTORY.eligibleCount,
    rejected: ODD_ONE_OUT_INVENTORY.rejectedCount,
    categories: ODD_ONE_OUT_INVENTORY.categoryDistribution,
    difficulty: ODD_ONE_OUT_INVENTORY.difficultyDistribution
  },
  vaultbreak: {
    proceduralCodeSpace: ALL_VAULTBREAK_CODES.length,
    solverValidatedDifficulties: ["approachable", "standard", "hard"],
    targetDifficultyPercent: { approachable: 40, standard: 45, hard: 15 },
    timeLimit: false
  },
  postcard: {
    technical: LANDMARKS.length,
    eligible: eligibleLandmarks.length,
    archiveOnly: archiveLandmarks.length,
    tiers: landmarkTiers,
    continents: landmarkContinents,
    categories: landmarkCategories
  },
  singAlong: {
    status: "retired",
    legacyReviewedRecords: SING_ALONG_CATALOG.length
  }
}, null, 2));
