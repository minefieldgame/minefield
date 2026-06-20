export type MinefieldGameId = "needledrop" | "top-ten" | "spelldrop" | "minefield" | "closer";

export type NeedleDropReviewData = {
  type: "needledrop";
  songTitle: string;
  artist: string;
  chartDate: string;
  chartPosition: number;
  artworkUrl: string;
  userGuesses: string[];
  won: boolean;
};

export type TopThreeReviewData = {
  type: "top-three";
  prompt: string;
  answers: string[];
  found: string[];
  missed: string[];
};

export type SpellDropReviewData = {
  type: "spelldrop";
  correctWord: string;
  userSpelling: string;
  correct: boolean;
};

export type MinefieldGridReviewData = {
  type: "minefield";
  minePositions: number[];
  safePicks: number[];
  path: number[];
  hitMine: boolean;
  clue: string;
};

export type CloserReviewData = {
  type: "closer";
  prompt: string;
  userGuess: number;
  rawGuess: string;
  actualAnswer: number;
  displayAnswer: string;
  percentError: number;
  sourceNote: string;
  scoreLabel: string;
};

export type MinefieldReviewData =
  | NeedleDropReviewData
  | TopThreeReviewData
  | SpellDropReviewData
  | MinefieldGridReviewData
  | CloserReviewData
  | { type: "legacy"; message: string };

export type MinefieldGameResult = {
  gameId: MinefieldGameId;
  displayName: string;
  icon: string;
  score: number;
  maxScore: number;
  completed: boolean;
  successUnits: number;
  totalUnits: number;
  summaryLabel: string;
  shareLine: string;
  reviewData: MinefieldReviewData;
  /** Retained so older archive UI and saved boards remain readable. */
  detail?: string;
};

export type MinefieldDailyBoard = {
  date: string;
  results: Partial<Record<MinefieldGameId, MinefieldGameResult>>;
  completedAt?: string;
};

export type MinefieldSummary = {
  date: string;
  totalScore: number;
  maxScore: number;
  gamesCompleted: number;
  totalGames: number;
  results: MinefieldGameResult[];
};

export type MinefieldStats = {
  currentStreak: number;
  maxStreak: number;
  lastCompletedDate?: string;
};
