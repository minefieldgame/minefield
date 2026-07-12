import { createSeededRandom, hashString } from "@/lib/dailySeed";
import type {
  VaultbreakAdminPayload,
  VaultbreakClue,
  VaultbreakClueCategory,
  VaultbreakClueInput,
  VaultbreakCode,
  VaultbreakDifficulty,
  VaultbreakDifficultyDiagnostics,
  VaultbreakDuplicateKeys,
  VaultbreakEliminationStep,
  VaultbreakPlayerPuzzle,
  VaultbreakPosition,
  VaultbreakPuzzle,
  VaultbreakScoringConfig,
  VaultbreakSubmissionResult,
  VaultbreakSubmissionScore
} from "@/games/vaultbreak/types";

const POSITION_NAMES = ["first", "second", "third", "last"] as const;
const PAIRS: readonly [VaultbreakPosition, VaultbreakPosition][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3]
];

export const VAULTBREAK_RULES = {
  codeLength: 4,
  noRepeatedDigits: true,
  leadingZeroAllowed: true
} as const;

export const VAULTBREAK_SCORING: VaultbreakScoringConfig = {
  exactSlotPoints: 10,
  solveBonus: 40,
  speedBonuses: [
    { underSeconds: 60, points: 20 },
    { underSeconds: 120, points: 15 },
    { underSeconds: 240, points: 10 },
    { underSeconds: 480, points: 5 }
  ],
  maximumScore: 100,
  hasTimeLimit: false
};

/** Checked by the release simulation against 2027-01-01 through 2027-12-31. */
export const VAULTBREAK_PROCEDURAL_HEALTH_BASELINE = {
  sampleDays: 365,
  validGeneratedPuzzles: 365,
  averageGenerationAttempts: 1.222,
  maximumGenerationAttemptsObserved: 5,
  difficultyDistribution: { approachable: 136, standard: 167, hard: 62 }
} as const;

export function isValidVaultbreakCode(
  code: string,
  options: { noRepeatedDigits?: boolean; leadingZeroAllowed?: boolean } = {}
) {
  if (!/^\d{4}$/.test(code)) return false;
  if (options.leadingZeroAllowed === false && code.startsWith("0")) return false;
  if (options.noRepeatedDigits !== false && new Set(code).size !== 4) return false;
  return true;
}

function codeDigits(code: string): readonly [number, number, number, number] | null {
  if (!/^\d{4}$/.test(code)) return null;
  return [Number(code[0]), Number(code[1]), Number(code[2]), Number(code[3])];
}

export function enumerateVaultbreakCodes(
  options: { noRepeatedDigits?: boolean; leadingZeroAllowed?: boolean } = {}
): VaultbreakCode[] {
  const codes: string[] = [];
  for (let value = 0; value <= 9999; value += 1) {
    const code = value.toString().padStart(4, "0");
    if (isValidVaultbreakCode(code, options)) codes.push(code);
  }
  return codes;
}

export const ALL_VAULTBREAK_CODES = Object.freeze(enumerateVaultbreakCodes());

export function evaluateVaultbreakClue(code: VaultbreakCode, clue: VaultbreakClue) {
  const digits = codeDigits(code);
  if (!digits) return false;
  switch (clue.type) {
    case "position-equals":
      return digits[clue.position] === clue.value;
    case "position-threshold":
      return clue.comparison === "greater-than"
        ? digits[clue.position] > clue.value
        : digits[clue.position] < clue.value;
    case "position-parity":
      return digits[clue.position] % 2 === (clue.parity === "even" ? 0 : 1);
    case "even-count":
      return digits.filter((digit) => digit % 2 === 0).length === clue.count;
    case "only-even-above":
      return digits[clue.position] % 2 === 0 &&
        digits[clue.position] > clue.threshold &&
        digits.filter((digit) => digit % 2 === 0 && digit > clue.threshold).length === 1;
    case "code-threshold": {
      const numericCode = Number(code);
      return clue.comparison === "greater-than"
        ? numericCode > clue.value
        : numericCode < clue.value;
    }
    case "position-between":
      return digits[clue.position] >= clue.minimum && digits[clue.position] <= clue.maximum;
    case "position-order":
      return clue.comparison === "greater-than"
        ? digits[clue.left] > digits[clue.right]
        : digits[clue.left] < digits[clue.right];
    case "position-offset":
      return digits[clue.left] === digits[clue.right] + clue.offset;
    case "positions-sum":
      return digits[clue.positions[0]] + digits[clue.positions[1]] === clue.value;
    case "digit-sum":
      return digits.reduce((sum, digit) => sum + digit, 0) === clue.value;
    case "positions-difference":
      return Math.abs(digits[clue.positions[0]] - digits[clue.positions[1]]) === clue.value;
    case "position-multiple":
      return digits[clue.productPosition] === digits[clue.basePosition] * clue.factor;
    case "contains-digit":
      return digits.includes(clue.value);
    case "excludes-digits":
      return clue.values.every((value) => !digits.includes(value));
    case "count-above":
      return digits.filter((digit) => digit > clue.threshold).length === clue.count;
    case "count-from-set":
      return digits.filter((digit) => clue.values.includes(digit)).length === clue.count;
    case "not-ascending":
      return !(digits[0] < digits[1] && digits[1] < digits[2] && digits[2] < digits[3]);
    case "position-extreme":
      return clue.extreme === "largest"
        ? digits[clue.position] === Math.max(...digits)
        : digits[clue.position] === Math.min(...digits);
    case "higher-than-neighbors":
      return digits[clue.position] > digits[clue.position - 1] &&
        digits[clue.position] > digits[clue.position + 1];
    case "not-contains-digit":
      return !digits.includes(clue.value);
    case "position-not-parity":
      return digits[clue.position] % 2 !== (clue.parity === "even" ? 0 : 1);
    case "position-not-greater-than":
      return digits[clue.left] <= digits[clue.right];
  }
}

export function evaluateVaultbreakClues(code: VaultbreakCode, clues: readonly VaultbreakClue[]) {
  return clues.every((clue) => evaluateVaultbreakClue(code, clue));
}

export function solveVaultbreak(
  clues: readonly VaultbreakClue[],
  candidates: readonly VaultbreakCode[] = ALL_VAULTBREAK_CODES
) {
  return candidates.filter((code) => evaluateVaultbreakClues(code, clues));
}

function createClue(clue: VaultbreakClueInput): VaultbreakClue {
  const identity = canonicalizeVaultbreakClue(clue);
  return { ...clue, id: `vb-${hashString(identity).toString(16).padStart(8, "0")}` } as VaultbreakClue;
}

function positionName(position: VaultbreakPosition) {
  return POSITION_NAMES[position];
}

function buildTrueCluePool(secretCode: string) {
  const digits = codeDigits(secretCode);
  if (!digits) throw new Error(`Invalid Vaultbreak secret code: ${secretCode}`);
  const clues: VaultbreakClue[] = [];
  const add = (clue: VaultbreakClueInput) => clues.push(createClue(clue));

  for (const position of [0, 1, 2, 3] as const) {
    const digit = digits[position];
    add({
      type: "position-equals",
      category: "direct",
      text: `The ${positionName(position)} digit is ${digit}.`,
      position,
      value: digit
    });
    for (const threshold of [2, 4, 5, 7]) {
      if (digit > threshold) {
        add({
          type: "position-threshold",
          category: "direct",
          text: `The ${positionName(position)} digit is greater than ${threshold}.`,
          position,
          comparison: "greater-than",
          value: threshold
        });
      } else if (digit < threshold) {
        add({
          type: "position-threshold",
          category: "direct",
          text: `The ${positionName(position)} digit is less than ${threshold}.`,
          position,
          comparison: "less-than",
          value: threshold
        });
      }
    }
    const parity = digit % 2 === 0 ? "even" : "odd";
    add({
      type: "position-parity",
      category: "parity",
      text: `The ${positionName(position)} digit is ${parity}.`,
      position,
      parity
    });
    add({
      type: "position-not-parity",
      category: "negative",
      text: `The ${positionName(position)} digit is not ${parity === "even" ? "odd" : "even"}.`,
      position,
      parity: parity === "even" ? "odd" : "even"
    });
    for (const width of [2, 3]) {
      const minimum = Math.max(0, digit - width);
      const maximum = Math.min(9, digit + width);
      if (maximum - minimum < 9) {
        add({
          type: "position-between",
          category: "range",
          text: `The ${positionName(position)} digit is between ${minimum} and ${maximum}, inclusive.`,
          position,
          minimum,
          maximum
        });
      }
    }
  }

  const evenCount = digits.filter((digit) => digit % 2 === 0).length;
  add({
    type: "even-count",
    category: "parity",
    text: `Exactly ${evenCount} ${evenCount === 1 ? "digit is" : "digits are"} even.`,
    count: evenCount
  });
  for (const position of [0, 1, 2, 3] as const) {
    const digit = digits[position];
    if (digit % 2 === 0 && digit > 5 && digits.filter((value) => value % 2 === 0 && value > 5).length === 1) {
      add({
        type: "only-even-above",
        category: "parity",
        text: `The ${positionName(position)} digit is the only even digit above 5.`,
        position,
        threshold: 5
      });
    }
  }

  const numericCode = Number(secretCode);
  const lowerBoundary = Math.floor(numericCode / 500) * 500;
  const upperBoundary = Math.min(9999, lowerBoundary + 500);
  if (numericCode > lowerBoundary) {
    add({
      type: "code-threshold",
      category: "range",
      text: `The code is higher than ${lowerBoundary.toString().padStart(4, "0")}.`,
      comparison: "greater-than",
      value: lowerBoundary
    });
  }
  if (numericCode < upperBoundary) {
    add({
      type: "code-threshold",
      category: "range",
      text: `The code is below ${upperBoundary.toString().padStart(4, "0")}.`,
      comparison: "less-than",
      value: upperBoundary
    });
  }

  for (const [left, right] of PAIRS) {
    const comparison = digits[left] > digits[right] ? "greater-than" : "less-than";
    add({
      type: "position-order",
      category: "relationship",
      text: `The ${positionName(left)} digit is ${comparison === "greater-than" ? "higher" : "lower"} than the ${positionName(right)} digit.`,
      left,
      comparison,
      right
    });
    add({
      type: "position-offset",
      category: "relationship",
      text: `The ${positionName(left)} digit is ${Math.abs(digits[left] - digits[right])} ${digits[left] > digits[right] ? "more" : "less"} than the ${positionName(right)} digit.`,
      left,
      right,
      offset: digits[left] - digits[right]
    });
    add({
      type: "positions-sum",
      category: "arithmetic",
      text: `The ${positionName(left)} and ${positionName(right)} digits add up to ${digits[left] + digits[right]}.`,
      positions: [left, right],
      value: digits[left] + digits[right]
    });
    add({
      type: "positions-difference",
      category: "arithmetic",
      text: `The ${positionName(left)} and ${positionName(right)} digits differ by ${Math.abs(digits[left] - digits[right])}.`,
      positions: [left, right],
      value: Math.abs(digits[left] - digits[right])
    });
    if (digits[right] > 0 && digits[left] === digits[right] * 2) {
      add({
        type: "position-multiple",
        category: "arithmetic",
        text: `The ${positionName(left)} digit is twice the ${positionName(right)} digit.`,
        productPosition: left,
        basePosition: right,
        factor: 2
      });
    }
    if (digits[left] > 0 && digits[right] === digits[left] * 2) {
      add({
        type: "position-multiple",
        category: "arithmetic",
        text: `The ${positionName(right)} digit is twice the ${positionName(left)} digit.`,
        productPosition: right,
        basePosition: left,
        factor: 2
      });
    }
  }
  add({
    type: "digit-sum",
    category: "arithmetic",
    text: `All four digits add up to ${digits.reduce((sum, digit) => sum + digit, 0)}.`,
    value: digits.reduce((sum, digit) => sum + digit, 0)
  });

  for (const digit of digits) {
    add({
      type: "contains-digit",
      category: "set",
      text: `One of the digits is ${digit}.`,
      value: digit
    });
  }
  const missingDigits = Array.from({ length: 10 }, (_, digit) => digit).filter((digit) => !digits.includes(digit));
  const missingGroups = [missingDigits.slice(0, 4), missingDigits.slice(-4), missingDigits.filter((digit) => digit % 2 === 0).slice(0, 4)];
  for (const values of missingGroups) {
    if (values.length >= 3) {
      add({
        type: "excludes-digits",
        category: "set",
        text: `None of the digits are in ${values.join(", ")}.`,
        values
      });
    }
  }
  for (const threshold of [3, 5, 7]) {
    const count = digits.filter((digit) => digit > threshold).length;
    add({
      type: "count-above",
      category: "set",
      text: `Exactly ${count} ${count === 1 ? "digit is" : "digits are"} greater than ${threshold}.`,
      threshold,
      count
    });
  }
  for (const values of [[0, 1, 2], [3, 4, 5], [7, 8, 9]] as const) {
    const count = digits.filter((digit) => values.includes(digit as never)).length;
    add({
      type: "count-from-set",
      category: "set",
      text: `The code contains exactly ${count} of ${values.join(", ")}.`,
      values,
      count
    });
  }

  if (!(digits[0] < digits[1] && digits[1] < digits[2] && digits[2] < digits[3])) {
    add({
      type: "not-ascending",
      category: "ordering",
      text: "The digits are not in ascending order."
    });
  }
  for (const position of [0, 1, 2, 3] as const) {
    if (digits[position] === Math.max(...digits)) {
      add({
        type: "position-extreme",
        category: "ordering",
        text: `The ${positionName(position)} digit is the largest digit.`,
        position,
        extreme: "largest"
      });
    }
    if (digits[position] === Math.min(...digits)) {
      add({
        type: "position-extreme",
        category: "ordering",
        text: `The ${positionName(position)} digit is the smallest digit.`,
        position,
        extreme: "smallest"
      });
    }
  }
  for (const position of [1, 2] as const) {
    if (digits[position] > digits[position - 1] && digits[position] > digits[position + 1]) {
      add({
        type: "higher-than-neighbors",
        category: "ordering",
        text: `The ${positionName(position)} digit is higher than both neighboring digits.`,
        position
      });
    }
  }

  for (const value of [0, 5, 9]) {
    if (!digits.includes(value)) {
      add({
        type: "not-contains-digit",
        category: "negative",
        text: `The code does not contain ${value}.`,
        value
      });
    }
  }
  for (const [left, right] of [[0, 2], [1, 3]] as const) {
    if (digits[left] <= digits[right]) {
      add({
        type: "position-not-greater-than",
        category: "negative",
        text: `The ${positionName(left)} digit is not greater than the ${positionName(right)} digit.`,
        left,
        right
      });
    }
  }

  const seenIds = new Set<string>();
  return clues.filter((clue) => {
    if (seenIds.has(clue.id)) return false;
    seenIds.add(clue.id);
    return true;
  });
}

function clueAllowedForDifficulty(clue: VaultbreakClue, difficulty: VaultbreakDifficulty) {
  if (difficulty === "hard" && clue.category === "direct") return false;
  return true;
}

function desiredRemaining(before: number, stepsIncludingCurrent: number) {
  if (stepsIncludingCurrent <= 1) return 1;
  return Math.max(2, Math.round(Math.exp(Math.log(before) * ((stepsIncludingCurrent - 1) / stepsIncludingCurrent))));
}

function selectClues(
  pool: readonly VaultbreakClue[],
  difficulty: VaultbreakDifficulty,
  targetCount: number,
  random: ReturnType<typeof createSeededRandom>
) {
  const selected: VaultbreakClue[] = [];
  let remaining = [...ALL_VAULTBREAK_CODES];

  if (difficulty === "approachable") {
    const direct = random.choice(pool.filter((clue) => clue.type === "position-equals"));
    selected.push(direct);
    remaining = remaining.filter((code) => evaluateVaultbreakClue(code, direct));
  }

  while (selected.length < targetCount) {
    const slotsLeft = targetCount - selected.length;
    const finalSlot = slotsLeft === 1;
    const categoryCounts = selected.reduce<Partial<Record<VaultbreakClueCategory, number>>>((counts, clue) => {
      counts[clue.category] = (counts[clue.category] ?? 0) + 1;
      return counts;
    }, {});
    const desired = desiredRemaining(remaining.length, slotsLeft);
    const options = pool
      .filter((clue) => !selected.some((item) => item.id === clue.id))
      .filter((clue) => clueAllowedForDifficulty(clue, difficulty))
      .filter((clue) => clue.type !== "position-equals")
      .filter((clue) => !(clue.category === "direct" && (categoryCounts.direct ?? 0) >= 1))
      .filter((clue) => !(clue.category === "negative" && (categoryCounts.negative ?? 0) >= 1))
      .map((clue) => {
        const next = remaining.filter((code) => evaluateVaultbreakClue(code, clue));
        const categoryRepeatPenalty = (categoryCounts[clue.category] ?? 0) * 0.45;
        const exactnessPenalty = finalSlot ? (next.length === 1 ? 0 : 100) : (next.length <= 1 ? 100 : 0);
        const targetPenalty = Math.abs(Math.log(Math.max(1, next.length)) - Math.log(desired));
        const diversityBonus = categoryCounts[clue.category] ? 0 : -0.3;
        return {
          clue,
          next,
          score: exactnessPenalty + targetPenalty + categoryRepeatPenalty + diversityBonus
        };
      })
      .filter((option) => option.next.length > 0 && option.next.length < remaining.length)
      .sort((a, b) => a.score - b.score || a.clue.id.localeCompare(b.clue.id));

    if (!options.length || (finalSlot && options[0].next.length !== 1)) return null;
    const shortlist = options.slice(0, Math.min(finalSlot ? 5 : 10, options.length));
    const picked = random.choice(shortlist);
    selected.push(picked.clue);
    remaining = picked.next;
  }

  const categoryCount = new Set(selected.map((clue) => clue.category)).size;
  const requiredCategoryCount = difficulty === "approachable" ? 3 : 4;
  const relationalArithmeticCount = selected.filter((clue) => clue.category === "relationship" || clue.category === "arithmetic").length;
  if (remaining.length !== 1 || categoryCount < requiredCategoryCount || relationalArithmeticCount < 1) return null;
  return selected;
}

function eliminationSteps(clues: readonly VaultbreakClue[]): VaultbreakEliminationStep[] {
  let candidates = [...ALL_VAULTBREAK_CODES];
  return clues.map((clue) => {
    const before = candidates.length;
    candidates = candidates.filter((code) => evaluateVaultbreakClue(code, clue));
    const eliminated = before - candidates.length;
    return {
      clueId: clue.id,
      clueType: clue.type,
      before,
      remaining: candidates.length,
      eliminated,
      eliminationRate: before ? Number((eliminated / before).toFixed(4)) : 0
    };
  });
}

function minimumUniqueSubsetSize(clues: readonly VaultbreakClue[]) {
  const satisfactionMasks = ALL_VAULTBREAK_CODES.map((code) => {
    let mask = 0;
    for (let index = 0; index < clues.length; index += 1) {
      if (evaluateVaultbreakClue(code, clues[index])) mask |= 1 << index;
    }
    return mask;
  });
  for (let size = 1; size <= clues.length; size += 1) {
    for (let mask = 1; mask < (1 << clues.length); mask += 1) {
      let selectedCount = 0;
      for (let bit = 0; bit < clues.length; bit += 1) selectedCount += (mask >> bit) & 1;
      if (selectedCount !== size) continue;
      let solutionCount = 0;
      for (const candidateMask of satisfactionMasks) {
        if ((candidateMask & mask) === mask) solutionCount += 1;
        if (solutionCount > 1) break;
      }
      if (solutionCount === 1) return size;
    }
  }
  return clues.length;
}

function buildDifficultyDiagnostics(
  clues: readonly VaultbreakClue[],
  seed: string,
  generationAttempts: number
): VaultbreakDifficultyDiagnostics {
  const steps = eliminationSteps(clues);
  const distribution: Record<VaultbreakClueCategory, number> = {
    direct: 0,
    parity: 0,
    range: 0,
    relationship: 0,
    arithmetic: 0,
    set: 0,
    ordering: 0,
    negative: 0
  };
  for (const clue of clues) distribution[clue.category] += 1;
  const directClueCount = distribution.direct;
  const relationalArithmeticClueCount = distribution.relationship + distribution.arithmetic;
  const minimumClues = minimumUniqueSubsetSize(clues);
  const averageRemainingRatio = steps.reduce((sum, step) => sum + step.remaining / step.before, 0) / steps.length;
  const difficultyScore = Math.max(0, Math.min(100, Math.round(
    12 +
    clues.length * 5 +
    minimumClues * 6 +
    relationalArithmeticClueCount * 3 +
    averageRemainingRatio * 18 -
    directClueCount * 18
  )));
  return {
    initialCandidateCount: ALL_VAULTBREAK_CODES.length,
    remainingCandidatesAfterEachClue: steps,
    finalSolutionCount: steps.at(-1)?.remaining ?? ALL_VAULTBREAK_CODES.length,
    difficultyScore,
    estimatedReasoningDepth: Math.max(1, minimumClues - directClueCount),
    minimumCluesForUniqueSolution: minimumClues,
    requiresCombiningClues: minimumClues > 1,
    directClueCount,
    relationalArithmeticClueCount,
    clueTypeDistribution: distribution,
    seed,
    generationAttempts
  };
}

function normalizeClueWithoutPresentation(clue: VaultbreakClue | VaultbreakClueInput) {
  const constraint = { ...clue } as Record<string, unknown>;
  delete constraint.id;
  delete constraint.text;
  return constraint;
}

export function canonicalizeVaultbreakClue(clue: VaultbreakClue | VaultbreakClueInput) {
  return JSON.stringify(normalizeClueWithoutPresentation(clue));
}

export function vaultbreakNormalizedClueSetKey(clues: readonly VaultbreakClue[]) {
  const normalized = clues.map(canonicalizeVaultbreakClue).sort().join("|");
  return `vaultbreak:clues:${hashString(normalized).toString(16).padStart(8, "0")}`;
}

export function vaultbreakExactPuzzleKey(secretCode: string, clues: readonly VaultbreakClue[]) {
  return `vaultbreak:exact:${secretCode}:${vaultbreakNormalizedClueSetKey(clues).split(":").at(-1)}`;
}

export function vaultbreakSecretCooldownKey(secretCode: string) {
  return `vaultbreak:secret:${secretCode}`;
}

export function vaultbreakCluePatternKey(clues: readonly VaultbreakClue[]) {
  const pattern = clues.map((clue) => clue.type).sort().join("|");
  return `vaultbreak:pattern:${hashString(pattern).toString(16).padStart(8, "0")}`;
}

export function getVaultbreakDuplicateKeys(secretCode: string, clues: readonly VaultbreakClue[]): VaultbreakDuplicateKeys {
  return {
    exactPuzzleKey: vaultbreakExactPuzzleKey(secretCode, clues),
    normalizedClueSetKey: vaultbreakNormalizedClueSetKey(clues),
    secretCodeCooldownKey: vaultbreakSecretCooldownKey(secretCode),
    cluePatternKey: vaultbreakCluePatternKey(clues)
  };
}

function buildExplanation(secretCode: string, clues: readonly VaultbreakClue[], steps: readonly VaultbreakEliminationStep[]) {
  return [
    ...clues.map((clue, index) => `${clue.text} (${steps[index].before.toLocaleString("en-US")} → ${steps[index].remaining.toLocaleString("en-US")} possible codes.)`),
    `Only ${secretCode} satisfies every clue without repeating a digit.`
  ];
}

function difficultyFromSeed(seed: string): VaultbreakDifficulty {
  const roll = createSeededRandom(`${seed}:difficulty`).random();
  if (roll < 0.4) return "approachable";
  if (roll < 0.85) return "standard";
  return "hard";
}

export class VaultbreakGenerationError extends Error {
  readonly attempts: number;

  constructor(message: string, attempts: number) {
    super(message);
    this.name = "VaultbreakGenerationError";
    this.attempts = attempts;
  }
}

export function generateVaultbreakPuzzle(
  dateOrSeed: string | number,
  requestedDifficulty?: VaultbreakDifficulty,
  retryOffset = 0,
  maxAttempts = 96
): VaultbreakPuzzle {
  const date = typeof dateOrSeed === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateOrSeed)
    ? dateOrSeed
    : undefined;
  const baseSeed = `vaultbreak:${String(dateOrSeed)}:v1:${retryOffset}`;
  const difficulty = requestedDifficulty ?? difficultyFromSeed(baseSeed);
  const random = createSeededRandom(`${baseSeed}:${difficulty}`);
  const countRange = difficulty === "approachable" ? [4, 5] : difficulty === "standard" ? [5, 6] : [6, 7];
  const secretOrder = random.shuffle(ALL_VAULTBREAK_CODES);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const secretCode = secretOrder[(attempt - 1) % secretOrder.length];
    const targetCount = random.int(countRange[0], countRange[1]);
    const pool = random.shuffle(buildTrueCluePool(secretCode));
    const clues = selectClues(pool, difficulty, targetCount, random);
    if (!clues) continue;
    const solutions = solveVaultbreak(clues);
    if (solutions.length !== 1 || solutions[0] !== secretCode) continue;
    if (clues.some((clue) => !evaluateVaultbreakClue(secretCode, clue))) continue;

    const diagnostics = buildDifficultyDiagnostics(clues, baseSeed, attempt);
    const duplicateKeys = getVaultbreakDuplicateKeys(secretCode, clues);
    const contentHashInput = `${secretCode}|${clues.map(canonicalizeVaultbreakClue).sort().join("|")}`;
    const contentHash = hashString(contentHashInput).toString(16).padStart(8, "0");
    return {
      gameId: "vaultbreak",
      version: "v1",
      id: `vaultbreak-${date ?? contentHash}-${contentHash}`,
      date,
      seed: baseSeed,
      title: "The Daily Vault",
      prompt: "Use the clues to crack the only possible vault code.",
      difficulty,
      clues,
      rules: VAULTBREAK_RULES,
      scoring: VAULTBREAK_SCORING,
      secretCode,
      explanation: buildExplanation(secretCode, clues, diagnostics.remainingCandidatesAfterEachClue),
      diagnostics,
      duplicateKeys,
      contentHash
    };
  }

  throw new VaultbreakGenerationError(
    `Unable to generate a unique ${difficulty} Vaultbreak puzzle within ${maxAttempts} attempts.`,
    maxAttempts
  );
}

export function scoreVaultbreakSubmission(
  secretCode: VaultbreakCode,
  submittedCode: VaultbreakCode,
  elapsedSeconds: number
): VaultbreakSubmissionScore {
  if (!isValidVaultbreakCode(secretCode)) throw new Error("Vaultbreak secret code must contain four distinct digits.");
  if (!/^\d{4}$/.test(submittedCode)) throw new Error("Vaultbreak submissions must contain exactly four digits.");
  const slotMatches = [0, 1, 2, 3].map((index) => submittedCode[index] === secretCode[index]) as [boolean, boolean, boolean, boolean];
  const exactDigits = slotMatches.filter(Boolean).length;
  const solved = exactDigits === 4;
  const safeElapsedSeconds = Math.max(0, Math.floor(Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0));
  const speedBonus = solved
    ? VAULTBREAK_SCORING.speedBonuses.find((bonus) => safeElapsedSeconds < bonus.underSeconds)?.points ?? 0
    : 0;
  const digitPoints = exactDigits * VAULTBREAK_SCORING.exactSlotPoints;
  const solveBonus = solved ? VAULTBREAK_SCORING.solveBonus : 0;
  return {
    submittedCode,
    exactDigits,
    slotMatches,
    solved,
    elapsedSeconds: safeElapsedSeconds,
    digitPoints,
    solveBonus,
    speedBonus,
    score: Math.min(VAULTBREAK_SCORING.maximumScore, digitPoints + solveBonus + speedBonus),
    maximumScore: 100,
    timedOut: false
  };
}

export function buildVaultbreakSubmissionResult(
  puzzle: VaultbreakPuzzle,
  submittedCode: VaultbreakCode,
  elapsedSeconds: number
): VaultbreakSubmissionResult {
  return {
    ...scoreVaultbreakSubmission(puzzle.secretCode, submittedCode, elapsedSeconds),
    correctCode: puzzle.secretCode,
    explanation: puzzle.explanation
  };
}

export function toVaultbreakPlayerPayload(puzzle: VaultbreakPuzzle): VaultbreakPlayerPuzzle {
  return {
    gameId: puzzle.gameId,
    version: puzzle.version,
    id: puzzle.id,
    date: puzzle.date,
    title: puzzle.title,
    prompt: puzzle.prompt,
    difficulty: puzzle.difficulty,
    clues: puzzle.clues,
    rules: puzzle.rules,
    scoring: puzzle.scoring,
    contentHash: puzzle.contentHash
  };
}

export function toVaultbreakAdminPayload(puzzle: VaultbreakPuzzle): VaultbreakAdminPayload {
  return {
    ...puzzle,
    cacheKey: puzzle.date ? `vaultbreak:${puzzle.date}:v1` : undefined
  };
}

export function formatVaultbreakElapsed(elapsedSeconds: number) {
  const safe = Math.max(0, Math.floor(elapsedSeconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export function buildVaultbreakShareRow(result: VaultbreakSubmissionScore) {
  const grid = result.slotMatches.map((matched) => matched ? "🟩" : "⬛").join("");
  return `Vaultbreak ${result.exactDigits}/4 ${result.solved ? "🔓" : "🔒"} ${formatVaultbreakElapsed(result.elapsedSeconds)}\n${grid}`;
}
