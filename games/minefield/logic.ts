import { hashString, seededShuffle } from "@/lib/dailySeed";

export type MinefieldDifficulty =
  | "Very Easy"
  | "Easy"
  | "Normal"
  | "Hard"
  | "Very Hard"
  | "Brutal";

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
  gridSize: 4;
  minePositions: number[];
};

export function getMinefieldDifficulty(runScore: number, runMaxScore = 600): MinefieldDifficultyProfile {
  const safeMax = Math.max(1, runMaxScore);
  const runPercentage = Math.max(0, Math.min(100, (runScore / safeMax) * 100));
  const settings =
    runPercentage >= 95 ? { difficulty: "Very Easy" as const, mineCount: 2, maxPicks: 6 } :
    runPercentage >= 90 ? { difficulty: "Easy" as const, mineCount: 3, maxPicks: 5 } :
    runPercentage >= 80 ? { difficulty: "Normal" as const, mineCount: 4, maxPicks: 5 } :
    runPercentage >= 70 ? { difficulty: "Hard" as const, mineCount: 5, maxPicks: 4 } :
    runPercentage >= 60 ? { difficulty: "Very Hard" as const, mineCount: 6, maxPicks: 4 } :
    { difficulty: "Brutal" as const, mineCount: 7, maxPicks: 3 };
  return {
    ...settings,
    runScore,
    runMaxScore: safeMax,
    runPercentage,
    safeTileCount: 16 - settings.mineCount
  };
}

export function resolveMinefieldPuzzle(
  date: string,
  runScore = 0,
  runMaxScore = 600
): MinefieldPuzzle {
  const profile = getMinefieldDifficulty(runScore, runMaxScore);
  const seed = hashString(`minefield-final:${date}:${profile.difficulty}`);
  const minePositions = seededShuffle(
    Array.from({ length: 16 }, (_, index) => index),
    seed
  ).slice(0, profile.mineCount).sort((a, b) => a - b);
  return {
    gameId: "minefield",
    date,
    seed,
    gridSize: 4,
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
