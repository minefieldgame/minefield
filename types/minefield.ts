export type MinefieldGameId =
  | "needledrop"
  | "minefield"
  | "ranked-top-5"
  | "spelldrop"
  | "closer"
  | "meet-me-halfway"
  | "landmark-drop";

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

export type RankedTopTenReviewData = {
  type: "ranked-top-5";
  prompt: string;
  userOrder: string[];
  correctOrder: string[];
  correctPositions: number[];
  attemptsUsed: number;
};

export type SpellDropReviewData = {
  type: "spelldrop";
  correctWord: string;
  userSpelling: string;
  correct: boolean;
  definition?: string;
};

export type MinefieldGridReviewData = {
  type: "minefield";
  minePositions: number[];
  safePicks: number[];
  path: number[];
  hitMine: boolean;
  difficulty: string;
  runScore: number;
  runMaxScore: number;
  runPercentage: number;
  gridSize: number;
  mineCount: number;
  maxPicks: number;
  clue?: string;
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

export type MeetMeHalfwayReviewData = {
  type: "meet-me-halfway";
  locationA: { name: string; country: string; latitude: number; longitude: number };
  locationB: { name: string; country: string; latitude: number; longitude: number };
  midpoint: { latitude: number; longitude: number };
  guess: { latitude: number; longitude: number };
  distanceKm: number;
};

export type LandmarkDropReviewData = {
  type: "landmark-drop";
  landmark: string;
  city: string;
  country: string;
  correct: { latitude: number; longitude: number };
  guess: { latitude: number; longitude: number };
  distanceKm: number;
  imageUrl: string;
};

export type MinefieldReviewData =
  | NeedleDropReviewData
  | RankedTopTenReviewData
  | SpellDropReviewData
  | MinefieldGridReviewData
  | CloserReviewData
  | MeetMeHalfwayReviewData
  | LandmarkDropReviewData
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
