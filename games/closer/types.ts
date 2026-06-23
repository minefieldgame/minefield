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
  scoringProfile: CloserScoringProfile;
  toleranceType: CloserToleranceType;
  allowNegative?: boolean;
  contentHash?: string;
  confidence?: number;
  generatedAt?: string;
};

export type CloserScore = {
  score: number;
  percentError: number;
  distanceFromAnswer: number;
  scoreLabel: string;
  scoringProfile: CloserScoringProfile;
};
