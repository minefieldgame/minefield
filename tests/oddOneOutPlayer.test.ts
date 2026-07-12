import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPlayableOddOneOutPuzzle,
  normalizeOddOneOutItem
} from "../games/odd-one-out/logic";
import type { OddOneOutPuzzle } from "../games/odd-one-out/types";
import { buildMinefieldShare, getPrepResults } from "../components/DailySummary";
import { ACTIVE_GAME_IDS, PRELIMINARY_GAME_IDS } from "../lib/gameDisplay";
import { calculateDailySummary } from "../lib/minefieldStorage";
import type { MinefieldGameResult, MinefieldSummary } from "../types/minefield";

const puzzle: OddOneOutPuzzle = {
  gameId: "odd-one-out",
  date: "2026-07-12",
  id: "odd-one-out:science:planets:001",
  candidateId: "odd-one-out:science:planets:001",
  category: "science",
  difficulty: "approachable",
  prompt: "Which one does not belong?",
  items: ["Saturn", "Jupiter", "Neptune", "Pluto", "Mars"],
  answer: "Pluto",
  explanation: "Pluto is a dwarf planet, while the other four are planets.",
  sharedProperty: "The other four are planets.",
  oddReason: "Pluto is classified as a dwarf planet.",
  qualityScore: 94,
  recognizabilityScore: 98,
  sourceNote: "NASA planetary classification reference",
  sourceStrategy: "project-authored-source-backed-template",
  contentHash: "odd-planets-hash",
  exactDuplicateKey: "odd-one-out:items:jupiter-mars-neptune-pluto-saturn",
  semanticTopicKey: "odd-one-out:topic:science-planets",
  answerKey: "odd-one-out:answer:pluto",
  validationVersion: "odd-one-out-v1",
  generatedAt: "2026-07-12T12:00:00.000Z",
  cacheHit: false,
  validation: {
    valid: true,
    checks: { fiveUniqueItems: true, answerIncluded: true },
    errors: []
  },
  diagnostics: {
    selectedDate: "2026-07-12",
    cacheKey: "odd-one-out:2026-07-12:v1",
    status: "Generated",
    contentHash: "odd-planets-hash",
    categoryFamily: "science",
    difficulty: "approachable",
    qualityScore: 94,
    recognizabilityScore: 98,
    exactDuplicateStatus: "available",
    cooldownStatus: "clear",
    inventoryTotal: 1_000,
    eligibleInventory: 1_000,
    unusedEligibleInventory: 1_000,
    rejectedCandidates: 0,
    selectedCandidateId: "odd-one-out:science:planets:001",
    sourceGenerationStrategy: "project-authored-source-backed-template",
    sourceStrategy: "project-authored-source-backed-template",
    dynamoDbReads: 1,
    dynamoDbKeysRead: 1,
    dynamoDbWrites: 1,
    candidateCollisionRetries: 0,
    generationDurationMs: 10
  }
};

test("active daily lineup includes Vaultbreak and keeps Sing Along retired", () => {
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
  assert.equal(new Set<string>(ACTIVE_GAME_IDS).has("sing-along"), false);
  assert.equal(PRELIMINARY_GAME_IDS.length, 8);
  assert.equal(new Set<string>(PRELIMINARY_GAME_IDS).has("minefield"), false);
});

test("retired Sing Along results are excluded from active prep scoring and sharing", () => {
  const result = (gameId: MinefieldGameResult["gameId"], displayName: string): MinefieldGameResult => ({
    gameId,
    displayName,
    icon: gameId === "odd-one-out" ? "🧩" : "🎤",
    score: 100,
    maxScore: 100,
    completed: true,
    successUnits: 1,
    totalUnits: 1,
    summaryLabel: "Correct",
    shareLine: `${displayName}: 100`,
    reviewData: { type: "legacy", message: "Legacy result" }
  });
  const summary: MinefieldSummary = {
    date: puzzle.date,
    totalScore: 200,
    maxScore: 200,
    gamesCompleted: 2,
    totalGames: 8,
    results: [result("sing-along", "Sing Along"), result("odd-one-out", "Odd One Out")]
  };
  assert.deepEqual(getPrepResults(summary).map((entry) => entry.gameId), ["odd-one-out"]);
  const share = buildMinefieldShare(summary);
  assert.match(share, /Odd One Out: 100/);
  assert.doesNotMatch(share, /Sing Along/);

  const legacySummary = { ...summary, results: [result("sing-along", "Sing Along")] };
  assert.deepEqual(getPrepResults(legacySummary).map((entry) => entry.gameId), ["sing-along"]);

  const activeSummary = calculateDailySummary({
    date: puzzle.date,
    results: {
      "sing-along": result("sing-along", "Sing Along"),
      "odd-one-out": result("odd-one-out", "Odd One Out")
    }
  });
  assert.equal(activeSummary.gamesCompleted, 1);
  assert.equal(activeSummary.totalScore, 100);
  assert.deepEqual(activeSummary.dailyBoard?.games.map((game) => game.gameId), [...ACTIVE_GAME_IDS]);
});

test("Odd One Out player accepts direct and wrapped authoritative payloads", () => {
  assert.equal(assertPlayableOddOneOutPuzzle(puzzle, puzzle.date).id, puzzle.id);
  assert.equal(assertPlayableOddOneOutPuzzle({ puzzle }, puzzle.date).answer, "Pluto");
});

test("Odd One Out player requires exactly five unique items and an included answer", () => {
  assert.throws(
    () => assertPlayableOddOneOutPuzzle({ ...puzzle, items: puzzle.items.slice(0, 4) } as unknown as OddOneOutPuzzle, puzzle.date),
    /exactly five/
  );
  assert.throws(
    () => assertPlayableOddOneOutPuzzle({ ...puzzle, items: ["Mars", "mars", "Venus", "Earth", "Pluto"] }, puzzle.date),
    /unique/
  );
  assert.throws(
    () => assertPlayableOddOneOutPuzzle({ ...puzzle, answer: "Mercury" }, puzzle.date),
    /answer must be one/
  );
});

test("Odd One Out answer matching is case- and whitespace-tolerant without changing item order", () => {
  const validated = assertPlayableOddOneOutPuzzle({
    ...puzzle,
    items: [" Saturn ", "Jupiter", "Neptune", "Pluto", "Mars"],
    answer: " saturn"
  }, puzzle.date);
  assert.deepEqual(validated.items, ["Saturn", "Jupiter", "Neptune", "Pluto", "Mars"]);
  assert.equal(validated.answer, "Saturn");
  assert.equal(normalizeOddOneOutItem(" SATURN "), normalizeOddOneOutItem("Saturn"));
});
