export type MinefieldGameId = "needledrop" | "top-ten";

export type MinefieldGameResult = {
  gameId: MinefieldGameId;
  displayName: string;
  score: number;
  maxScore: number;
  completed: boolean;
  detail: string;
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
