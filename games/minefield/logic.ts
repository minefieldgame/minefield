import { hashString, seededShuffle } from "@/lib/dailySeed";

export type MinefieldPuzzle = {
  gameId: "minefield";
  date: string;
  seed: number;
  gridSize: 5;
  mineCount: 3;
  maxPicks: 5;
  minePositions: number[];
  clue: string;
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
    minePositions,
    clue: buildMinefieldClue(minePositions)
  };
}

export function buildMinefieldClue(mines: number[]) {
  const corners = new Set([0, 4, 20, 24]);
  const center = 12;
  const edgeCount = mines.filter((index) => {
    const row = Math.floor(index / 5);
    const column = index % 5;
    return row === 0 || row === 4 || column === 0 || column === 4;
  }).length;
  if (!mines.includes(center)) return "Today’s mines avoid the center.";
  if (mines.every((index) => !corners.has(index))) return "Today’s mines avoid the corners.";
  if (edgeCount >= 2) return "Today’s mines favor the edges.";
  const distances = mines.flatMap((value, index) =>
    mines.slice(index + 1).map((other) =>
      Math.abs(Math.floor(value / 5) - Math.floor(other / 5)) +
      Math.abs((value % 5) - (other % 5))
    )
  );
  return Math.max(...distances) <= 4
    ? "Today’s mines are clustered."
    : "Today’s mines are spread out.";
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
