export type CloserDifficulty = "easy" | "medium" | "hard";
export type CloserScoringProfile =
  | "small-integer"
  | "medium-count"
  | "large-estimate"
  | "year"
  | "percentage";
export type CloserToleranceType = "absolute" | "percent";

export type CloserPuzzle = {
  gameId: "closer";
  date: string;
  seed: number;
  id: string;
  category: string;
  prompt: string;
  answer: number;
  unit: string;
  displayAnswer: string;
  acceptableRangeNote: string;
  sourceNote: string;
  difficulty: CloserDifficulty;
  difficultyTier?: "approachable" | "standard" | "challenging";
  qualityScore?: number;
  recognizabilityScore?: number;
  unitFamiliarity?: number;
  answerStability?: number;
  scoringProfile: CloserScoringProfile;
  toleranceType: CloserToleranceType;
  allowNegative?: boolean;
  contentHash?: string;
  confidence?: number;
  generatedAt?: string;
  uniqueContentKey?: string;
  duplicateCheck?: {
    duplicateDetected: boolean;
    passed: boolean;
    regenerationCount: number;
    retryCount: number;
    exhaustedCandidatePool: boolean;
    checkedAgainstCount: number;
    recentlyUsedKeys: string[];
    warning?: string;
  };
  repeatStatus?: {
    checked: boolean;
    passed?: boolean;
    duplicateDetected?: boolean;
    retryCount: number;
    provider: string;
    warning?: string;
  };
};

export type CloserScore = {
  score: number;
  percentError: number;
  distanceFromAnswer: number;
  scoreLabel: string;
  scoringProfile: CloserScoringProfile;
};
