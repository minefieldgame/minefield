export type RankedTopTenDirection = "highest-to-lowest" | "lowest-to-highest";

export type RankedTopTenAnswer = {
  rank: number;
  answer: string;
  displayAnswer: string;
  aliases: string[];
  value: string;
  sourceNote: string;
};

export type RankedTopTenValidation = {
  valid: boolean;
  checks: {
    exactlyTenAnswers: boolean;
    sequentialRanks: boolean;
    uniqueAnswers: boolean;
    valuesPresent: boolean;
    directionClear: boolean;
    objectiveCategory: boolean;
    generalAudience: boolean;
    concisePlayerPrompt: boolean;
    sourceNotesPresent: boolean;
    reliableSources: boolean;
  };
  errors: string[];
};

export type RankedTopTenPuzzle = {
  gameId: "ranked-top-10";
  id: string;
  date: string;
  title: string;
  playerPrompt: string;
  adminPrompt: string;
  category: string;
  rankingMetric: string;
  direction: RankedTopTenDirection;
  answers: RankedTopTenAnswer[];
  sources: string[];
  confidence: number;
  contentHash?: string;
  generatedAt: string;
  generator?: string;
  cacheHit?: boolean;
  generationDurationMs?: number;
  validation: RankedTopTenValidation;
  rawAIResponse?: unknown;
};

export type RankedTopTenState = {
  dateKey: string;
  puzzle: RankedTopTenPuzzle;
  order: string[];
  lockedPositions: number[];
  attemptsUsed: number;
  lastIncorrectPositions: number[];
  status: "playing" | "completed" | "gave-up";
  updatedAt: string;
};
