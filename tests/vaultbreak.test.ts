import assert from "node:assert/strict";
import test from "node:test";
import type { VaultbreakClue, VaultbreakClueInput, VaultbreakDifficulty } from "../games/vaultbreak/types";
import {
  ALL_VAULTBREAK_CODES,
  buildVaultbreakShareRow,
  buildVaultbreakSubmissionResult,
  enumerateVaultbreakCodes,
  evaluateVaultbreakClue,
  evaluateVaultbreakClues,
  generateVaultbreakPuzzle,
  isValidVaultbreakCode,
  scoreVaultbreakSubmission,
  solveVaultbreak,
  toVaultbreakAdminPayload,
  toVaultbreakPlayerPayload,
  vaultbreakCluePatternKey,
  vaultbreakExactPuzzleKey,
  vaultbreakNormalizedClueSetKey,
  vaultbreakSecretCooldownKey
} from "../games/vaultbreak/logic";

function clue(value: VaultbreakClueInput): VaultbreakClue {
  return { id: `test-${value.type}`, ...value } as VaultbreakClue;
}

test("Vaultbreak enumerates all 5,040 no-repeat codes and permits a leading zero", () => {
  assert.equal(ALL_VAULTBREAK_CODES.length, 5_040);
  assert.ok(ALL_VAULTBREAK_CODES.includes("0123"));
  assert.equal(ALL_VAULTBREAK_CODES.filter((code) => code.startsWith("0")).length, 504);
  assert.equal(enumerateVaultbreakCodes({ leadingZeroAllowed: false }).length, 4_536);
  assert.equal(enumerateVaultbreakCodes({ noRepeatedDigits: false }).length, 10_000);
  assert.equal(isValidVaultbreakCode("5681"), true);
  assert.equal(isValidVaultbreakCode("5581"), false);
  assert.equal(isValidVaultbreakCode("123"), false);
});

test("direct, parity, and range clues evaluate deterministically", () => {
  assert.equal(evaluateVaultbreakClue("5681", clue({
    type: "position-equals", category: "direct", text: "", position: 1, value: 6
  })), true);
  assert.equal(evaluateVaultbreakClue("5681", clue({
    type: "position-threshold", category: "direct", text: "", position: 2, comparison: "greater-than", value: 6
  })), true);
  assert.equal(evaluateVaultbreakClue("5681", clue({
    type: "position-parity", category: "parity", text: "", position: 2, parity: "even"
  })), true);
  assert.equal(evaluateVaultbreakClue("5681", clue({
    type: "even-count", category: "parity", text: "", count: 2
  })), true);
  assert.equal(evaluateVaultbreakClue("1385", clue({
    type: "only-even-above", category: "parity", text: "", position: 2, threshold: 5
  })), true);
  assert.equal(evaluateVaultbreakClue("5681", clue({
    type: "code-threshold", category: "range", text: "", comparison: "greater-than", value: 5000
  })), true);
  assert.equal(evaluateVaultbreakClue("0123", clue({
    type: "code-threshold", category: "range", text: "", comparison: "less-than", value: 500
  })), true);
  assert.equal(evaluateVaultbreakClue("5681", clue({
    type: "position-between", category: "range", text: "", position: 0, minimum: 3, maximum: 7
  })), true);
});

test("relationship and arithmetic clues evaluate exactly", () => {
  const clues: VaultbreakClue[] = [
    clue({ type: "position-order", category: "relationship", text: "", left: 2, comparison: "greater-than", right: 1 }),
    clue({ type: "position-offset", category: "relationship", text: "", left: 1, right: 2, offset: -2 }),
    clue({ type: "positions-sum", category: "arithmetic", text: "", positions: [0, 1], value: 11 }),
    clue({ type: "digit-sum", category: "arithmetic", text: "", value: 20 }),
    clue({ type: "positions-difference", category: "arithmetic", text: "", positions: [0, 2], value: 3 })
  ];
  assert.equal(evaluateVaultbreakClues("5681", clues), true);
  assert.equal(evaluateVaultbreakClue("2481", clue({
    type: "position-multiple", category: "arithmetic", text: "", productPosition: 1, basePosition: 0, factor: 2
  })), true);
  assert.equal(evaluateVaultbreakClues("5682", clues), false);
});

test("set, ordering, and negative clues evaluate exactly", () => {
  const setClues: VaultbreakClue[] = [
    clue({ type: "contains-digit", category: "set", text: "", value: 5 }),
    clue({ type: "excludes-digits", category: "set", text: "", values: [0, 2, 3, 4] }),
    clue({ type: "count-above", category: "set", text: "", threshold: 5, count: 2 }),
    clue({ type: "count-from-set", category: "set", text: "", values: [7, 8, 9], count: 1 }),
    clue({ type: "not-ascending", category: "ordering", text: "" }),
    clue({ type: "position-extreme", category: "ordering", text: "", position: 2, extreme: "largest" }),
    clue({ type: "higher-than-neighbors", category: "ordering", text: "", position: 2 }),
    clue({ type: "not-contains-digit", category: "negative", text: "", value: 0 }),
    clue({ type: "position-not-parity", category: "negative", text: "", position: 3, parity: "even" }),
    clue({ type: "position-not-greater-than", category: "negative", text: "", left: 0, right: 2 })
  ];
  assert.equal(evaluateVaultbreakClues("5681", setClues), true);
  assert.equal(evaluateVaultbreakClue("5680", setClues[7]), false);
});

test("the solver proves a valid puzzle unique and identifies zero- and multi-solution sets", () => {
  const exampleClues: VaultbreakClue[] = [
    clue({ type: "contains-digit", category: "set", text: "One digit is 5.", value: 5 }),
    clue({ type: "position-order", category: "relationship", text: "Third higher than second.", left: 2, comparison: "greater-than", right: 1 }),
    clue({ type: "position-equals", category: "direct", text: "Last is 1.", position: 3, value: 1 }),
    clue({ type: "position-equals", category: "direct", text: "Second is 6.", position: 1, value: 6 }),
    clue({ type: "position-parity", category: "parity", text: "Third is even.", position: 2, parity: "even" })
  ];
  assert.deepEqual(solveVaultbreak(exampleClues), ["5681"]);

  const impossible = [
    clue({ type: "position-equals", category: "direct", text: "", position: 0, value: 1 }),
    clue({ type: "position-equals", category: "direct", text: "", position: 0, value: 2 })
  ];
  assert.equal(solveVaultbreak(impossible).length, 0);
  assert.ok(solveVaultbreak(impossible.slice(0, 1)).length > 1);
});

test("the deterministic generator creates solver-proven puzzles for every difficulty tier", () => {
  const ranges: Record<VaultbreakDifficulty, readonly [number, number]> = {
    approachable: [4, 5],
    standard: [5, 6],
    hard: [6, 7]
  };
  const scores: number[] = [];
  for (const difficulty of ["approachable", "standard", "hard"] as const) {
    const puzzle = generateVaultbreakPuzzle("2028-04-30", difficulty);
    const [minimum, maximum] = ranges[difficulty];
    assert.equal(puzzle.difficulty, difficulty);
    assert.ok(puzzle.clues.length >= minimum && puzzle.clues.length <= maximum);
    assert.equal(new Set(puzzle.secretCode).size, 4);
    assert.ok(puzzle.clues.every((item) => evaluateVaultbreakClue(puzzle.secretCode, item)));
    assert.deepEqual(solveVaultbreak(puzzle.clues), [puzzle.secretCode]);
    assert.equal(puzzle.diagnostics.initialCandidateCount, 5_040);
    assert.equal(puzzle.diagnostics.finalSolutionCount, 1);
    assert.equal(puzzle.diagnostics.remainingCandidatesAfterEachClue.length, puzzle.clues.length);
    assert.equal(puzzle.diagnostics.remainingCandidatesAfterEachClue.at(-1)?.remaining, 1);
    assert.ok(puzzle.diagnostics.remainingCandidatesAfterEachClue.every((step) => step.eliminated > 0));
    assert.ok(puzzle.diagnostics.difficultyScore > 0);
    assert.ok(puzzle.diagnostics.estimatedReasoningDepth > 0);
    assert.ok(puzzle.diagnostics.requiresCombiningClues);
    assert.ok(puzzle.diagnostics.generationAttempts >= 1 && puzzle.diagnostics.generationAttempts <= 96);
    assert.ok(Object.values(puzzle.diagnostics.clueTypeDistribution).reduce((sum, count) => sum + count, 0) === puzzle.clues.length);
    if (difficulty === "approachable") {
      assert.equal(puzzle.clues.filter((item) => item.type === "position-equals").length, 1);
      assert.equal(puzzle.clues.filter((item) => item.category === "direct").length, 1);
    } else if (difficulty === "standard") {
      assert.equal(puzzle.clues.some((item) => item.type === "position-equals"), false);
      assert.ok(puzzle.clues.filter((item) => item.category === "direct").length <= 1);
    } else {
      assert.equal(puzzle.clues.some((item) => item.type === "position-equals"), false);
      assert.equal(puzzle.clues.some((item) => item.category === "direct"), false);
    }
    scores.push(puzzle.diagnostics.difficultyScore);
  }
  assert.ok(scores[0] < Math.min(scores[1], scores[2]), JSON.stringify(scores));
});

test("generation is stable by seed, retryable by offset, and uses canonical duplicate keys", () => {
  const first = generateVaultbreakPuzzle("2030-01-15", "standard");
  const second = generateVaultbreakPuzzle("2030-01-15", "standard");
  const retry = generateVaultbreakPuzzle("2030-01-15", "standard", 1);
  assert.deepEqual(second, first);
  assert.notEqual(retry.duplicateKeys.exactPuzzleKey, first.duplicateKeys.exactPuzzleKey);
  assert.equal(first.duplicateKeys.exactPuzzleKey, vaultbreakExactPuzzleKey(first.secretCode, [...first.clues].reverse()));
  assert.equal(first.duplicateKeys.normalizedClueSetKey, vaultbreakNormalizedClueSetKey([...first.clues].reverse()));
  assert.equal(first.duplicateKeys.secretCodeCooldownKey, vaultbreakSecretCooldownKey(first.secretCode));
  assert.equal(first.duplicateKeys.cluePatternKey, vaultbreakCluePatternKey([...first.clues].reverse()));
});

test("120 deterministic daily generations follow the intended mix with no repeated clue sets", () => {
  const clueSetKeys = new Set<string>();
  const exactKeys = new Set<string>();
  const counts: Record<VaultbreakDifficulty, number> = { approachable: 0, standard: 0, hard: 0 };
  for (let day = 0; day < 120; day += 1) {
    const date = new Date(Date.UTC(2029, 0, 1 + day)).toISOString().slice(0, 10);
    const puzzle = generateVaultbreakPuzzle(date);
    assert.deepEqual(solveVaultbreak(puzzle.clues), [puzzle.secretCode], date);
    assert.equal(clueSetKeys.has(puzzle.duplicateKeys.normalizedClueSetKey), false, date);
    assert.equal(exactKeys.has(puzzle.duplicateKeys.exactPuzzleKey), false, date);
    clueSetKeys.add(puzzle.duplicateKeys.normalizedClueSetKey);
    exactKeys.add(puzzle.duplicateKeys.exactPuzzleKey);
    counts[puzzle.difficulty] += 1;
  }
  assert.equal(clueSetKeys.size, 120);
  assert.ok(counts.approachable >= 35 && counts.approachable <= 65, JSON.stringify(counts));
  assert.ok(counts.standard >= 40 && counts.standard <= 70, JSON.stringify(counts));
  assert.ok(counts.hard >= 8 && counts.hard <= 28, JSON.stringify(counts));
});

test("scoring rewards exact slots, exact solve, and speed without a timeout", () => {
  const fast = scoreVaultbreakSubmission("5681", "5681", 45);
  assert.deepEqual({ score: fast.score, digits: fast.digitPoints, solve: fast.solveBonus, speed: fast.speedBonus }, {
    score: 100, digits: 40, solve: 40, speed: 20
  });
  assert.equal(scoreVaultbreakSubmission("5681", "5681", 180).score, 90);
  const slow = scoreVaultbreakSubmission("5681", "5681", 600);
  assert.equal(slow.score, 80);
  assert.equal(slow.solved, true);
  assert.equal(slow.timedOut, false);
  const partial = scoreVaultbreakSubmission("5681", "5689", 20_000);
  assert.equal(partial.exactDigits, 3);
  assert.equal(partial.score, 30);
  assert.equal(partial.solveBonus, 0);
  assert.equal(partial.speedBonus, 0);
  assert.equal(partial.timedOut, false);
});

test("player payload is answer-safe while result/admin helpers reveal only at the right time", () => {
  const puzzle = generateVaultbreakPuzzle("2031-08-09", "approachable");
  const player = toVaultbreakPlayerPayload(puzzle);
  const serializedPlayer = JSON.stringify(player);
  assert.equal("secretCode" in player, false);
  assert.equal("diagnostics" in player, false);
  assert.equal("explanation" in player, false);
  assert.equal(serializedPlayer.includes(puzzle.secretCode), false);

  const result = buildVaultbreakSubmissionResult(puzzle, puzzle.secretCode, 75);
  assert.equal(result.correctCode, puzzle.secretCode);
  assert.equal(result.solved, true);
  assert.ok(result.explanation.length > puzzle.clues.length);
  assert.equal(toVaultbreakAdminPayload(puzzle).cacheKey, "vaultbreak:2031-08-09:v1");
  assert.match(buildVaultbreakShareRow(result), /^Vaultbreak 4\/4 🔓 1:15\n🟩🟩🟩🟩$/);
});
