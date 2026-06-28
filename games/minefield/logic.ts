import { hashString, seededShuffle } from "@/lib/dailySeed";

export type MinefieldDifficulty =
  | "Gifted"
  | "Very Easy"
  | "Easy"
  | "Comfortable"
  | "Normal"
  | "Hard"
  | "Very Hard"
  | "Brutal"
  | "Nightmare";

export type MinefieldDifficultyProfile = {
  difficulty: MinefieldDifficulty;
  runScore: number;
  runMaxScore: number;
  runPercentage: number;
  mineCount: number;
  safeTileCount: number;
  maxPicks: number;
};

export type MinefieldPuzzle = MinefieldDifficultyProfile & {
  gameId: "minefield";
  date: string;
  seed: number;
  gridSize: 5;
  minePositions: number[];
};

export function getMinefieldDifficulty(runScore: number, runMaxScore = 700): MinefieldDifficultyProfile {
  const safeMax = Math.max(1, runMaxScore);
  const runPercentage = Math.max(0, Math.min(100, (runScore / safeMax) * 100));
  const settings =
    runPercentage >= 95 ? { difficulty: "Gifted" as const, mineCount: 2 } :
    runPercentage >= 90 ? { difficulty: "Very Easy" as const, mineCount: 3 } :
    runPercentage >= 85 ? { difficulty: "Easy" as const, mineCount: 4 } :
    runPercentage >= 80 ? { difficulty: "Comfortable" as const, mineCount: 5 } :
    runPercentage >= 70 ? { difficulty: "Normal" as const, mineCount: 6 } :
    runPercentage >= 60 ? { difficulty: "Hard" as const, mineCount: 7 } :
    runPercentage >= 50 ? { difficulty: "Very Hard" as const, mineCount: 8 } :
    runPercentage >= 40 ? { difficulty: "Brutal" as const, mineCount: 9 } :
    { difficulty: "Nightmare" as const, mineCount: 10 };
  return {
    ...settings,
    maxPicks: 4,
    runScore,
    runMaxScore: safeMax,
    runPercentage,
    safeTileCount: 25 - settings.mineCount
  };
}

export function resolveMinefieldPuzzle(
  date: string,
  runScore = 0,
  runMaxScore = 700
): MinefieldPuzzle {
  const profile = getMinefieldDifficulty(runScore, runMaxScore);
  const seed = hashString(`minefield-final:${date}:${profile.difficulty}`);
  const minePositions = seededShuffle(
    Array.from({ length: 25 }, (_, index) => index),
    seed
  ).slice(0, profile.mineCount).sort((a, b) => a - b);
  return {
    gameId: "minefield",
    date,
    seed,
    gridSize: 5,
    minePositions,
    ...profile
  };
}

export function minefieldScore(safePicks: number, maxPicks: number) {
  return Math.round((safePicks / Math.max(1, maxPicks)) * 100);
}

export function minefieldScoreLabel(score: number, hitMine: boolean) {
  if (hitMine && score === 0) return "Boom";
  if (!hitMine && score === 100) return "Minefield Cleared";
  if (score >= 80) return "Great run";
  if (score >= 60) return "Solid escape";
  if (score >= 30) return "Close call";
  return hitMine ? "Boom" : "Got out alive";
}
