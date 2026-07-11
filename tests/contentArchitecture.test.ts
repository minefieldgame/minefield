import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { LANDMARKS } from "../data/landmarks";
import { BALLPARK_CANDIDATES, BUZZWORD_CANDIDATES, IN_ORDER_CANDIDATES, validateBuzzwordCandidate, validateNumericCandidate, validateObjectiveOrdering } from "../lib/content/preparedInventories";
import { validateOriginalRecordingMetadata, validateSingAlongTimingCandidate } from "../lib/content/candidateValidation";
import { classifyInventoryHealth } from "../lib/content/inventoryPolicy";
import { simulateDailyInventory } from "../lib/content/inventorySimulation";
import { buildDailyBoardSeedManifest } from "../lib/dailySeed";
import { createMusicUsedContentKey, createUniqueContentKey, normalizeUsedContentText } from "../lib/content/usedContentRegistry";
import { SING_ALONG_CATALOG } from "../data/singAlongCatalog";

test("prepared inventories meet architecture baselines and validate", () => {
  assert.equal(BUZZWORD_CANDIDATES.length, 5000);
  assert.ok(BUZZWORD_CANDIDATES.every(validateBuzzwordCandidate));
  assert.ok(BALLPARK_CANDIDATES.length >= 2000);
  assert.ok(BALLPARK_CANDIDATES.every(validateNumericCandidate));
  assert.ok(IN_ORDER_CANDIDATES.length >= 500);
  assert.ok(IN_ORDER_CANDIDATES.every(validateObjectiveOrdering));
  assert.equal(LANDMARKS.length, 500);
});

test("prepared catalogs have no malformed or duplicate exact identities", () => {
  const unique = (values: string[]) => assert.equal(new Set(values).size, values.length);
  unique(BUZZWORD_CANDIDATES.map((item) => normalizeUsedContentText(item.word)));
  unique(BUZZWORD_CANDIDATES.map((item) => normalizeUsedContentText(item.definition)));
  unique(IN_ORDER_CANDIDATES.map((item) => createUniqueContentKey("ranked-top-5", "list", [item.metric, ...item.items.map(([name]) => name).sort()])));
  unique(BALLPARK_CANDIDATES.map((item) => createUniqueContentKey("closer", "question", [item.prompt])));
  unique(LANDMARKS.map((item) => item.id));
  unique(LANDMARKS.map((item) => normalizeUsedContentText(item.name)));
  unique(LANDMARKS.map((item) => item.imageFile.toLowerCase()));
  unique(LANDMARKS.map((item) => `${item.latitude.toFixed(5)},${item.longitude.toFixed(5)}`));
});

test("landmark photos have stable IDs, attribution, licenses, dimensions, and valid coordinates", () => {
  for (const item of LANDMARKS) {
    assert.match(item.id, /^Q\d+$/);
    assert.ok(Math.abs(item.latitude) <= 90 && Math.abs(item.longitude) <= 180);
    assert.notEqual(item.mimeType, "image/svg+xml");
    assert.ok(item.width >= 640 && item.height >= 480);
    assert.ok(item.attribution && item.license && item.sourceNote.includes("commons.wikimedia.org"));
  }
});

test("media validators enforce lyric timing and reject mismatched recordings", () => {
  assert.ok(SING_ALONG_CATALOG.every((item) => validateSingAlongTimingCandidate(item).valid));
  assert.equal(validateOriginalRecordingMetadata({ title: "Song (Karaoke Version)", artist: "Tribute Band", previewUrl: "https://example.test/a.m4a" }).valid, false);
  assert.equal(validateOriginalRecordingMetadata({ title: "Original Song", artist: "Original Artist", previewUrl: "https://example.test/a.m4a" }).valid, true);
  assert.equal(new Set(SING_ALONG_CATALOG.map((item) => createMusicUsedContentKey(item.artist, item.title))).size, SING_ALONG_CATALOG.length);
});

test("game validators reject ties, malformed words, vague numeric facts, and audible answer cues", () => {
  assert.equal(validateObjectiveOrdering({ ...IN_ORDER_CANDIDATES[0], numericValues: [5, 4, 4, 2, 1] }), false);
  assert.equal(validateBuzzwordCandidate({ ...BUZZWORD_CANDIDATES[0], commonMisspellings: [BUZZWORD_CANDIDATES[0].word, "other"] }), false);
  assert.equal(validateNumericCandidate({ ...BALLPARK_CANDIDATES[0], answer: 0 }), false);
  assert.equal(validateSingAlongTimingCandidate({ ...SING_ALONG_CATALOG[0], clipEndTimeSeconds: SING_ALONG_CATALOG[0].answerLyricStartTimeSeconds }).valid, false);
});

test("shared music identity blocks the same song across Rewind and Sing Along", () => {
  const rewind = createMusicUsedContentKey("Beyoncé", "Crazy in Love");
  const singAlong = createMusicUsedContentKey("Beyonce", "The Crazy in Love");
  assert.equal(rewind, singAlong);
});

test("365-day fixture simulation never relaxes exact duplicate exclusion and replenishes low inventory", () => {
  const base = Array.from({ length: 500 }, (_, index) => ({ id: `candidate-${index}`, softTopic: `topic-${index % 10}` }));
  const result = simulateDailyInventory({ gameId: "simulation", candidates: base, days: 365, replenishBelow: 200, replenish: (round) => Array.from({ length: 300 }, (_, index) => ({ id: `replenished-${round}-${index}`, softTopic: `topic-${index % 10}` })), cooldownDays: 90 });
  assert.equal(result.exactRepeats, 0);
  assert.equal(new Set(result.selectedIds).size, 365);
  assert.ok(result.replenishments >= 1);
});

test("deterministic large-pool selection is stable and soft cooldown can relax", () => {
  const candidates = Array.from({ length: 400 }, (_, index) => ({ id: `stable-${index}`, softTopic: "one-topic" }));
  const first = simulateDailyInventory({ gameId: "stable", candidates, days: 30, cooldownDays: 365 });
  const second = simulateDailyInventory({ gameId: "stable", candidates, days: 30, cooldownDays: 365 });
  assert.deepEqual(first.selectedIds, second.selectedIds);
  assert.equal(first.exactRepeats, 0);
});

test("candidate exhaustion fails closed, while a secondary replenishment strategy recovers", () => {
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

test("health labels distinguish low, critical, and exhausted inventory", () => {
  assert.equal(classifyInventoryHealth(500, 500, 500), "Healthy");
  assert.equal(classifyInventoryHealth(500, 100, 500), "Low inventory");
  assert.equal(classifyInventoryHealth(500, 5, 500), "Critically low");
  assert.equal(classifyInventoryHealth(0, 0, 500), "Exhausted");
});

test("atomic publication reserves daily and used-content records in one conditional transaction", () => {
  const source = fs.readFileSync(new URL("../lib/content/persistence.ts", import.meta.url), "utf8");
  assert.match(source, /TransactWriteItemsCommand/);
  assert.match(source, /attribute_not_exists\(dateGameKey\)/);
  assert.match(source, /attribute_not_exists\(uniqueContentKey\)/);
  assert.match(source, /Duplicate content key prevented publishing/);
  assert.match(source, /getPersistedPuzzle<T>\(gameId, dateKey\)/);
  assert.match(source, /BatchGetItemCommand/);
});
