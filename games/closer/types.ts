export type CloserDifficulty = "easy" | "medium" | "hard";

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
  allowNegative?: boolean;
};

export type CloserScore = {
  score: number;
  percentError: number;
  distanceFromAnswer: number;
  scoreLabel: string;
};
