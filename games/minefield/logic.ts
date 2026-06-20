import { hashString, seededShuffle } from "@/lib/dailySeed";

export type MinefieldPuzzle = {
  gameId: "minefield";
  date: string;
  seed: number;
  gridSize: 5;
  mineCount: 3;
  maxPicks: 5;
  minePositions: number[];
};

export function resolveMinefieldPuzzle(date: string): MinefieldPuzzle {
  const seed = hashString(`minefield-grid:${date}`);
  const minePositions = seededShuffle(
    Array.from({ length: 25 }, (_, index) => index),
    seed
  ).slice(0, 3).sort((a, b) => a - b);
  return {
    gameId: "minefield",
    date,
    seed,
    gridSize: 5,
    mineCount: 3,
    maxPicks: 5,
    minePositions
  };
}

export function minefieldScoreLabel(score: number, hitMine: boolean) {
  if (hitMine && score === 0) return "Boom";
  if (score >= 100) return "Perfect sweep";
  if (score >= 80) return "Great run";
  if (score >= 60) return "Solid escape";
  if (score >= 40) return hitMine ? "Close call" : "Close call";
  if (score >= 20) return "Got out alive";
  return "Boom";
}
