export const VAULTBREAK_POSITIONS = [0, 1, 2, 3] as const;

export type VaultbreakPosition = (typeof VAULTBREAK_POSITIONS)[number];
export type VaultbreakCode = string;
export type VaultbreakDifficulty = "approachable" | "standard" | "hard";
export type VaultbreakClueCategory =
  | "direct"
  | "parity"
  | "range"
  | "relationship"
  | "arithmetic"
  | "set"
  | "ordering"
  | "negative";

type VaultbreakClueBase<
  Type extends string,
  Category extends VaultbreakClueCategory
> = {
  id: string;
  type: Type;
  category: Category;
  text: string;
};

export type VaultbreakClue =
  | (VaultbreakClueBase<"position-equals", "direct"> & {
      position: VaultbreakPosition;
      value: number;
    })
  | (VaultbreakClueBase<"position-threshold", "direct"> & {
      position: VaultbreakPosition;
      comparison: "greater-than" | "less-than";
      value: number;
    })
  | (VaultbreakClueBase<"position-parity", "parity"> & {
      position: VaultbreakPosition;
      parity: "even" | "odd";
    })
  | (VaultbreakClueBase<"even-count", "parity"> & {
      count: number;
    })
  | (VaultbreakClueBase<"only-even-above", "parity"> & {
      position: VaultbreakPosition;
      threshold: number;
    })
  | (VaultbreakClueBase<"code-threshold", "range"> & {
      comparison: "greater-than" | "less-than";
      value: number;
    })
  | (VaultbreakClueBase<"position-between", "range"> & {
      position: VaultbreakPosition;
      minimum: number;
      maximum: number;
    })
  | (VaultbreakClueBase<"position-order", "relationship"> & {
      left: VaultbreakPosition;
      comparison: "greater-than" | "less-than";
      right: VaultbreakPosition;
    })
  | (VaultbreakClueBase<"position-offset", "relationship"> & {
      left: VaultbreakPosition;
      right: VaultbreakPosition;
      offset: number;
    })
  | (VaultbreakClueBase<"positions-sum", "arithmetic"> & {
      positions: readonly [VaultbreakPosition, VaultbreakPosition];
      value: number;
    })
  | (VaultbreakClueBase<"digit-sum", "arithmetic"> & {
      value: number;
    })
  | (VaultbreakClueBase<"positions-difference", "arithmetic"> & {
      positions: readonly [VaultbreakPosition, VaultbreakPosition];
      value: number;
    })
  | (VaultbreakClueBase<"position-multiple", "arithmetic"> & {
      productPosition: VaultbreakPosition;
      basePosition: VaultbreakPosition;
      factor: number;
    })
  | (VaultbreakClueBase<"contains-digit", "set"> & {
      value: number;
    })
  | (VaultbreakClueBase<"excludes-digits", "set"> & {
      values: readonly number[];
    })
  | (VaultbreakClueBase<"count-above", "set"> & {
      threshold: number;
      count: number;
    })
  | (VaultbreakClueBase<"count-from-set", "set"> & {
      values: readonly number[];
      count: number;
    })
  | VaultbreakClueBase<"not-ascending", "ordering">
  | (VaultbreakClueBase<"position-extreme", "ordering"> & {
      position: VaultbreakPosition;
      extreme: "largest" | "smallest";
    })
  | (VaultbreakClueBase<"higher-than-neighbors", "ordering"> & {
      position: 1 | 2;
    })
  | (VaultbreakClueBase<"not-contains-digit", "negative"> & {
      value: number;
    })
  | (VaultbreakClueBase<"position-not-parity", "negative"> & {
      position: VaultbreakPosition;
      parity: "even" | "odd";
    })
  | (VaultbreakClueBase<"position-not-greater-than", "negative"> & {
      left: VaultbreakPosition;
      right: VaultbreakPosition;
    });

type WithoutClueId<T> = T extends unknown ? Omit<T, "id"> : never;
export type VaultbreakClueInput = WithoutClueId<VaultbreakClue>;

export type VaultbreakEliminationStep = {
  clueId: string;
  clueType: VaultbreakClue["type"];
  before: number;
  remaining: number;
  eliminated: number;
  eliminationRate: number;
};

export type VaultbreakDifficultyDiagnostics = {
  initialCandidateCount: number;
  remainingCandidatesAfterEachClue: VaultbreakEliminationStep[];
  finalSolutionCount: number;
  difficultyScore: number;
  estimatedReasoningDepth: number;
  minimumCluesForUniqueSolution: number;
  requiresCombiningClues: boolean;
  directClueCount: number;
  relationalArithmeticClueCount: number;
  clueTypeDistribution: Record<VaultbreakClueCategory, number>;
  seed: string;
  generationAttempts: number;
};

export type VaultbreakScoringConfig = {
  exactSlotPoints: 10;
  solveBonus: 40;
  speedBonuses: readonly [
    { underSeconds: 60; points: 20 },
    { underSeconds: 120; points: 15 },
    { underSeconds: 240; points: 10 },
    { underSeconds: 480; points: 5 }
  ];
  maximumScore: 100;
  hasTimeLimit: false;
};

export type VaultbreakRules = {
  codeLength: 4;
  noRepeatedDigits: true;
  leadingZeroAllowed: true;
};

export type VaultbreakDuplicateKeys = {
  exactPuzzleKey: string;
  normalizedClueSetKey: string;
  secretCodeCooldownKey: string;
  cluePatternKey: string;
};

export type VaultbreakPuzzle = {
  gameId: "vaultbreak";
  version: "v1";
  id: string;
  date?: string;
  seed: string;
  title: string;
  prompt: string;
  difficulty: VaultbreakDifficulty;
  clues: VaultbreakClue[];
  rules: VaultbreakRules;
  scoring: VaultbreakScoringConfig;
  secretCode: VaultbreakCode;
  explanation: string[];
  diagnostics: VaultbreakDifficultyDiagnostics;
  duplicateKeys: VaultbreakDuplicateKeys;
  contentHash: string;
};

export type VaultbreakPlayerPuzzle = Omit<
  VaultbreakPuzzle,
  "secretCode" | "explanation" | "diagnostics" | "duplicateKeys" | "seed"
>;

export type VaultbreakSubmissionScore = {
  submittedCode: VaultbreakCode;
  exactDigits: number;
  slotMatches: readonly [boolean, boolean, boolean, boolean];
  solved: boolean;
  elapsedSeconds: number;
  digitPoints: number;
  solveBonus: number;
  speedBonus: number;
  score: number;
  maximumScore: 100;
  timedOut: false;
};

export type VaultbreakSubmissionResult = VaultbreakSubmissionScore & {
  correctCode: VaultbreakCode;
  explanation: string[];
};

export type VaultbreakAdminPayload = VaultbreakPuzzle & {
  cacheKey?: string;
  contentHash: string;
};
