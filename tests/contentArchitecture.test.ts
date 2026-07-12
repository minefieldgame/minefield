import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { LANDMARKS } from "../data/landmarks";
import { SING_ALONG_CATALOG } from "../data/singAlongCatalog";
import { validateOriginalRecordingMetadata, validateSingAlongTimingCandidate } from "../lib/content/candidateValidation";
import { classifyInventoryHealth } from "../lib/content/inventoryPolicy";
import { simulateDailyInventory, type SimulationCandidate } from "../lib/content/inventorySimulation";
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
import { createMusicUsedContentKey, createUniqueContentKey, normalizeUsedContentText } from "../lib/content/usedContentRegistry";
import { buildDailyBoardSeedManifest } from "../lib/dailySeed";
import { ACTIVE_GAME_IDS, PRELIMINARY_GAME_IDS } from "../lib/gameDisplay";

const eligibleBuzzwords = BUZZWORD_CANDIDATES.filter(validateBuzzwordCandidate);
const eligibleLandmarks = LANDMARKS.filter(isLandmarkEligible);

function unique(values: string[]) {
  assert.equal(new Set(values).size, values.length);
}

test("active release lineup includes Odd One Out and excludes retired Sing Along", () => {
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
  assert.deepEqual(PRELIMINARY_GAME_IDS, ACTIVE_GAME_IDS.slice(0, -1));
  assert.equal(new Set<string>(ACTIVE_GAME_IDS).has("sing-along"), false);
});

test("prepared inventories meet fully eligible release baselines", () => {
  assert.ok(BUZZWORD_CANDIDATES.length >= 5_000);
  assert.ok(eligibleBuzzwords.length >= 4_000);
  assert.ok(eligibleBuzzwords.length < BUZZWORD_CANDIDATES.length, "Quality failures must be excluded instead of retained to preserve a headline count");

  const ballparkDistribution = validateBallparkInventoryDistribution(BALLPARK_CANDIDATES);
  assert.ok(BALLPARK_CANDIDATES.length >= 500);
  assert.equal(ballparkDistribution.valid, true, ballparkDistribution.errors.join(" | "));
  assert.ok(BALLPARK_CANDIDATES.every(validateNumericCandidate));

  const inOrderDistribution = validateInOrderInventoryDistribution(IN_ORDER_CANDIDATES);
  assert.ok(IN_ORDER_CANDIDATES.length >= 600);
  assert.equal(inOrderDistribution.valid, true, inOrderDistribution.errors.join(" | "));
  assert.ok(IN_ORDER_CANDIDATES.every(validateObjectiveOrdering));

  assert.equal(ODD_ONE_OUT_INVENTORY.valid, true, ODD_ONE_OUT_INVENTORY.errors.join(" | "));
  assert.ok(ODD_ONE_OUT_INVENTORY.eligibleCount >= 1_000);
  assert.ok(ODD_ONE_OUT_INVENTORY.eligibleCandidates.every((candidate) => validateOddOneOutCandidate(candidate).valid));

  assert.ok(LANDMARKS.length >= 500);
  assert.ok(eligibleLandmarks.length >= 500);
});

test("In Order is diversified, recognizable, and rejects country-coordinate rankings", () => {
  const distribution = validateInOrderInventoryDistribution(IN_ORDER_CANDIDATES);
  const counts = Object.values(distribution.counts);
  const countryFacts = distribution.counts["mainstream-country-city-facts"] ?? 0;
  assert.equal(distribution.valid, true, distribution.errors.join(" | "));
  assert.ok(Object.keys(distribution.counts).filter((key) => distribution.counts[key] >= 10).length >= 10);
  assert.ok(Math.max(...counts) <= IN_ORDER_CANDIDATES.length * 0.2);
  assert.ok(countryFacts <= IN_ORDER_CANDIDATES.length * 0.15);
  assert.ok(IN_ORDER_CANDIDATES.every((candidate) => !/latitude|longitude/i.test(`${candidate.metric} ${candidate.playerPrompt}`)));
  assert.ok(IN_ORDER_CANDIDATES.every((candidate) => !/snapshot|structured[- ]data|provider|indicator code/i.test(candidate.playerPrompt)));
  assert.ok(IN_ORDER_CANDIDATES.every((candidate) => candidate.recognizableAnchorCount >= 1 && candidate.qualityApproved));
});

test("Ballpark questions are balanced, natural, grammatical, and quality-approved", () => {
  const distribution = validateBallparkInventoryDistribution(BALLPARK_CANDIDATES);
  assert.equal(distribution.valid, true, distribution.errors.join(" | "));
  assert.ok(Object.keys(distribution.counts).filter((key) => !key.startsWith("tier:")).length >= 8);
  assert.ok(BALLPARK_CANDIDATES.every((candidate) => candidate.qualityApproved && candidate.qualityScore >= 72));
  assert.ok(BALLPARK_CANDIDATES.every((candidate) => !/snapshot|structured[- ]data|provider name|indicator code|database|api response/i.test(candidate.prompt)));
  assert.ok(BALLPARK_CANDIDATES.every((candidate) => !/official (?:currenc|language).*(?:listed|recorded)/i.test(candidate.prompt)));
  assert.ok(BALLPARK_CANDIDATES.every((candidate) => !/\b1 (?:currencies|official languages)\b/i.test(`${candidate.prompt} ${candidate.displayAnswer}`)));
  assert.deepEqual(
    [...new Set(BALLPARK_CANDIDATES.map((candidate) => candidate.difficultyTier))].sort(),
    ["approachable", "challenging", "standard"]
  );
});

test("Buzzword eligibility applies readable-pronunciation and plausible-misspelling gates", () => {
  assert.ok(eligibleBuzzwords.every((candidate) => candidate.pronunciationValid && candidate.misspellingValid));
  assert.ok(eligibleBuzzwords.every((candidate) => !/\d|\b[A-Z]{1,3}\d\b/.test(candidate.pronunciationHint)));
  assert.ok(eligibleBuzzwords.every((candidate) => candidate.commonMisspellings.length >= 2));
  assert.ok(eligibleBuzzwords.every((candidate) => candidate.commonMisspellings.length === candidate.misspellingEvidence.length));
  assert.ok(eligibleBuzzwords.every((candidate) => candidate.misspellingEvidence.every((evidence) => evidence.score >= 0.7)));
  assert.ok(eligibleBuzzwords.every((candidate) => candidate.misspellingPlausibilityScore >= 70));
});

test("prepared catalogs have no malformed or duplicate exact identities", () => {
  unique(BUZZWORD_CANDIDATES.map((item) => normalizeUsedContentText(item.word)));
  unique(eligibleBuzzwords.map((item) => normalizeUsedContentText(item.definition)));
  unique(IN_ORDER_CANDIDATES.map((item) => createUniqueContentKey("ranked-top-5", "ranking", [item.metric, item.direction, item.items.map(([name]) => name).sort().join("|")])));
  unique(BALLPARK_CANDIDATES.map((item) => createUniqueContentKey("closer", "question-answer", [item.prompt, item.answer, item.unit])));
  unique(ODD_ONE_OUT_INVENTORY.eligibleCandidates.map((item) => item.exactDuplicateKey));
  unique(LANDMARKS.map((item) => item.id));
  unique(LANDMARKS.map((item) => normalizeUsedContentText(item.name)));
  unique(LANDMARKS.map((item) => item.imageFile.toLowerCase()));
  unique(LANDMARKS.map((item) => `${item.latitude.toFixed(5)},${item.longitude.toFixed(5)}`));
});

test("Postcard separates technical validity from normal-play quality", () => {
  for (const item of LANDMARKS) {
    assert.match(item.id, /^Q\d+$/);
    assert.ok(Math.abs(item.latitude) <= 90 && Math.abs(item.longitude) <= 180);
    assert.notEqual(item.mimeType, "image/svg+xml");
    assert.ok(item.width >= 640 && item.height >= 480);
    assert.ok(item.attribution && item.license && item.sourceNote.includes("commons.wikimedia.org"));
    assert.ok(item.imageQualityScore >= 0 && item.imageQualityScore <= 100);
    assert.ok(item.focalSubjectQuality >= 0 && item.focalSubjectQuality <= 100);
    assert.ok(item.subjectDominance >= 0 && item.subjectDominance <= 100);
    assert.ok(["subject-dominant", "subject-in-context", "incidental-or-unclear"].includes(item.imageFraming));
    assert.ok(item.focalSubjectReason.length >= 20);
    assert.ok(item.landmarkPlayabilityScore >= 0 && item.landmarkPlayabilityScore <= 100);
  }
  assert.ok(eligibleLandmarks.every((item) => item.eligibilityStatus === "eligible" && item.qualityEvaluation.finalEligibility));
  assert.ok(eligibleLandmarks.every((item) => item.recognizabilityTier !== "archive-only"));
  const archiveOnly = LANDMARKS.filter((item) => item.eligibilityStatus === "archive-only");
  assert.ok(archiveOnly.length > 0);
  assert.ok(archiveOnly.every((item) => !isLandmarkEligible(item) && item.recognizabilityTier === "archive-only" && item.exclusionReason));
  assert.equal(LANDMARKS.find((item) => item.id === "Q656765")?.eligibilityStatus, "archive-only");
  assert.equal(LANDMARKS.find((item) => item.id === "Q234364")?.eligibilityStatus, "archive-only", "Demolished Tuileries Palace must not enter normal play");
  assert.equal(LANDMARKS.find((item) => item.id === "Q202902")?.eligibilityStatus, "archive-only", "Destroyed Crystal Palace must not enter normal play");
  assert.equal(LANDMARKS.find((item) => item.name === "Volksparkstadion")?.recognizabilityTier, "challenging");
  const bakuTower = LANDMARKS.find((item) => item.name === "Baku TV Tower");
  assert.equal(bakuTower?.imageFile, "Baku Botanical Garden 60 (cropped).jpg");
  assert.equal(bakuTower?.eligibilityStatus, "archive-only", "An incidental Botanical Garden image must not enter normal play as Baku TV Tower");
  assert.equal(bakuTower?.imageFraming, "incidental-or-unclear");
  assert.ok(eligibleLandmarks.every((item) => !["tower", "stadium", "bridge"].includes(item.category.toLowerCase()) || item.subjectDominance >= 70));

  const selectorSource = fs.readFileSync(new URL("../games/geography/serverPuzzles.ts", import.meta.url), "utf8");
  assert.match(selectorSource, /candidates\.filter\(isLandmarkEligible\)/);
  assert.match(selectorSource, /shouldRelaxSoftCooldown/);
  assert.match(selectorSource, /random\.random\(\) >= 0\.06/);
  assert.match(selectorSource, /recognizabilityTier === "iconic" \? 14/);
  assert.match(selectorSource, /recognizabilityTier === "recognizable" \? 7 : 0\.25/);
  assert.match(selectorSource, /selectedFocalSubjectQuality/);
  assert.match(selectorSource, /selectedSubjectDominance/);
  assert.match(selectorSource, /selectedImageFraming/);

  const adminSource = fs.readFileSync(new URL("../components/admin/AdminGeographyPreviews.tsx", import.meta.url), "utf8");
  assert.match(adminSource, /Selected landmark tier/);
  assert.match(adminSource, /Focal-subject quality/);
  assert.match(adminSource, /Subject dominance/);
  assert.match(adminSource, /Image framing/);
  assert.match(adminSource, /Landmark playability score/);
});

test("retired Sing Along catalog remains structurally safe for legacy records", () => {
  assert.ok(SING_ALONG_CATALOG.length > 0);
  assert.ok(SING_ALONG_CATALOG.every((item) => item.eligibilityState === "archive-only"));
  assert.ok(SING_ALONG_CATALOG.every((item) => validateSingAlongTimingCandidate(item).valid));
  assert.equal(new Set(SING_ALONG_CATALOG.map((item) => createMusicUsedContentKey(item.artist, item.title))).size, SING_ALONG_CATALOG.length);
  const legacyRoute = fs.readFileSync(new URL("../app/api/sing-along/route.ts", import.meta.url), "utf8");
  assert.match(legacyRoute, /resolveSingAlongForDate/);
});

test("game validators reject ties, malformed words, vague numeric facts, and altered recordings", () => {
  assert.equal(validateObjectiveOrdering({ ...IN_ORDER_CANDIDATES[0], numericValues: [5, 4, 4, 2, 1] }), false);
  assert.equal(validateBuzzwordCandidate({ ...eligibleBuzzwords[0], commonMisspellings: [eligibleBuzzwords[0].word, "other"] }), false);
  assert.equal(validateNumericCandidate({ ...BALLPARK_CANDIDATES[0], answer: 0 }), false);
  assert.equal(validateOriginalRecordingMetadata({ title: "Song (Karaoke Version)", artist: "Tribute Band", previewUrl: "https://example.test/a.m4a" }).valid, false);
  assert.equal(validateOriginalRecordingMetadata({ title: "Original Song", artist: "Original Artist", previewUrl: "https://example.test/a.m4a" }).valid, true);
  assert.equal(validateSingAlongTimingCandidate({ ...SING_ALONG_CATALOG[0], clipEndTimeSeconds: SING_ALONG_CATALOG[0].answerLyricStartTimeSeconds }).valid, false);
});

test("shared music identity remains compatible with old Rewind and Sing Along records", () => {
  const rewind = createMusicUsedContentKey("Beyoncé", "Crazy in Love");
  const singAlong = createMusicUsedContentKey("Beyonce", "The Crazy in Love");
  assert.equal(rewind, singAlong);
});

test("365-day release simulation covers every active game with no exact repeats", () => {
  const fixtures = (prefix: string, count: number): SimulationCandidate[] => Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    category: `${prefix}-${index % 12}`,
    qualityTier: index % 10 === 0 ? "challenging" : "standard",
    softTopic: `${prefix}-topic-${index % 200}`
  }));
  const runs = [
    simulateDailyInventory({ gameId: "needledrop", candidates: fixtures("rewind", 4_000), cooldownDays: 45 }),
    simulateDailyInventory({ gameId: "odd-one-out", candidates: ODD_ONE_OUT_INVENTORY.eligibleCandidates.map((item) => ({ id: item.exactDuplicateKey, category: item.category, qualityTier: item.difficulty, softTopic: item.semanticTopicKey })), cooldownDays: 21 }),
    simulateDailyInventory({ gameId: "vaultbreak", candidates: fixtures("vaultbreak", 5_040), cooldownDays: 30 }),
    simulateDailyInventory({ gameId: "ranked-top-5", candidates: IN_ORDER_CANDIDATES.map((item) => ({ id: item.id, category: item.categoryFamily, qualityTier: item.difficultyTier, softTopic: item.semanticTopic })), cooldownDays: 45 }),
    simulateDailyInventory({ gameId: "spelldrop", candidates: eligibleBuzzwords.map((item) => ({ id: item.id, category: item.difficulty, qualityTier: item.difficulty })), cooldownDays: 90 }),
    simulateDailyInventory({ gameId: "closer", candidates: BALLPARK_CANDIDATES.map((item) => ({ id: item.id, category: item.category, qualityTier: item.difficultyTier, softTopic: item.topic })), cooldownDays: 45 }),
    simulateDailyInventory({ gameId: "meet-me-halfway", candidates: fixtures("city-pair", 5_000), cooldownDays: 30 }),
    simulateDailyInventory({ gameId: "landmark-drop", candidates: eligibleLandmarks.map((item) => ({ id: item.id, category: item.continent, qualityTier: item.recognizabilityTier, softTopic: `${item.country}:${item.category}` })), cooldownDays: 60 }),
    simulateDailyInventory({ gameId: "minefield", candidates: fixtures("daily-board", 730), cooldownDays: 0 })
  ];
  assert.deepEqual(runs.map((run) => run.gameId), [...ACTIVE_GAME_IDS]);
  assert.equal(runs.some((run) => run.gameId === "sing-along"), false);
  for (const run of runs) {
    assert.equal(run.days, 365);
    assert.equal(run.exactRepeats, 0, run.gameId);
    assert.equal(new Set(run.selectedIds).size, 365, run.gameId);
    assert.equal(run.replenishments, 0, run.gameId);
  }
});

test("deterministic selection is stable and soft cooldown may relax without exact reuse", () => {
  const candidates = Array.from({ length: 400 }, (_, index) => ({ id: `stable-${index}`, softTopic: "one-topic" }));
  const first = simulateDailyInventory({ gameId: "stable", candidates, days: 30, cooldownDays: 365 });
  const second = simulateDailyInventory({ gameId: "stable", candidates, days: 30, cooldownDays: 365 });
  assert.deepEqual(first.selectedIds, second.selectedIds);
  assert.equal(first.exactRepeats, 0);
});

test("candidate exhaustion fails closed, while a replenishment strategy recovers", () => {
  assert.throws(() => simulateDailyInventory({ gameId: "closed", candidates: [{ id: "only" }], days: 2 }), /exhausted/);
  const recovered = simulateDailyInventory({ gameId: "recovered", candidates: [{ id: "only" }], days: 2, replenishBelow: 1, replenish: () => [{ id: "secondary" }] });
  assert.equal(recovered.exactRepeats, 0);
  assert.equal(recovered.replenishments, 1);
});

test("authoritative board summary marks failed routes failed with no puzzle hash", () => {
  const manifest = buildDailyBoardSeedManifest("2027-01-01", ["spelldrop", "closer"], { spelldrop: "abc123" }, {}, {}, { spelldrop: "Generated", closer: "Failed" });
  assert.equal(manifest.games[0].status, "Generated");
  assert.equal(manifest.games[1].status, "Failed");
  assert.equal(manifest.games[1].puzzleHash, "");
  assert.equal(manifest.games[1].duplicateCheck.passed, false);
});

test("health labels distinguish low, critical, and exhausted eligible inventory", () => {
  assert.equal(classifyInventoryHealth(500, 500, 500), "Healthy");
  assert.equal(classifyInventoryHealth(500, 100, 500), "Low eligible inventory");
  assert.equal(classifyInventoryHealth(500, 5, 500), "Critically low eligible inventory");
  assert.equal(classifyInventoryHealth(0, 0, 500), "Exhausted");
});

test("atomic publication dedupes keys, reserves exact keys permanently, and returns transaction winners", () => {
  const persistence = fs.readFileSync(new URL("../lib/content/persistence.ts", import.meta.url), "utf8");
  const semantics = fs.readFileSync(new URL("../lib/content/publishSemantics.ts", import.meta.url), "utf8");
  assert.match(persistence, /TransactWriteItemsCommand/);
  assert.match(persistence, /ConditionExpression: "attribute_not_exists\(dateGameKey\)"/);
  assert.match(persistence, /dedupeUsedContentRecords\(usedContentRecords\)/);
  assert.match(persistence, /reservationMode === "permanent"/);
  assert.match(persistence, /reservationMode === "cooldown"/);
  assert.match(persistence, /const racedPuzzle = await getPersistedPuzzle<T>\(gameId, dateKey\)/);
  assert.match(persistence, /const secondWinnerRead = await getPersistedPuzzle<T>\(gameId, dateKey\)/);
  assert.match(persistence, /CandidateContentCollisionError/);
  assert.match(persistence, /BatchGetItemCommand/);
  assert.match(semantics, /dedupeItemKeys/);
  assert.match(semantics, /record\.reservationMode === "permanent" \? "attribute_not_exists\(uniqueContentKey\)" : undefined/);
  assert.match(semantics, /retryCandidateCollisions/);
});
