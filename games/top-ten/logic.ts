import { hashString, seededShuffle } from "@/lib/dailySeed";
import type { RankedTopTenPuzzle } from "@/games/top-ten/types";

export function correctOrder(puzzle: RankedTopTenPuzzle) {
  return [...puzzle.answers]
    .sort((left, right) => left.rank - right.rank)
    .map((answer) => answer.answer);
}

export function initialRankedOrder(puzzle: RankedTopTenPuzzle) {
  const correct = correctOrder(puzzle);
  let shuffled = seededShuffle(correct, hashString(`ranked-top-10:shuffle:${puzzle.date}`));
  if (shuffled.every((answer, index) => answer === correct[index])) {
    shuffled = [...shuffled.slice(1), shuffled[0]];
  }
  return shuffled;
}

export function evaluateRankedOrder(order: string[], puzzle: RankedTopTenPuzzle) {
  const expected = correctOrder(puzzle);
  return order.flatMap((answer, index) => answer === expected[index] ? [index] : []);
}

export function moveAmongUnlocked(
  order: string[],
  fromIndex: number,
  toIndex: number,
  lockedPositions: number[]
) {
  if (fromIndex === toIndex) return order;
  const locked = new Set(lockedPositions);
  if (locked.has(fromIndex) || locked.has(toIndex)) return order;
  const openSlots = order.map((_, index) => index).filter((index) => !locked.has(index));
  const fromOpenIndex = openSlots.indexOf(fromIndex);
  const toOpenIndex = openSlots.indexOf(toIndex);
  if (fromOpenIndex < 0 || toOpenIndex < 0) return order;
  const openValues = openSlots.map((index) => order[index]);
  const [moved] = openValues.splice(fromOpenIndex, 1);
  openValues.splice(toOpenIndex, 0, moved);
  const next = [...order];
  openSlots.forEach((slot, index) => {
    next[slot] = openValues[index];
  });
  return next;
}

export function rankedTopTenScore(lockedPositions: number[]) {
  return new Set(lockedPositions).size * 10;
}

export function rankedTopTenLabel(score: number) {
  if (score === 100) return "Perfect ranking";
  if (score >= 80) return "Great order";
  if (score >= 60) return "Solid ranking";
  if (score >= 30) return "Mixed up";
  return "Way off";
}
