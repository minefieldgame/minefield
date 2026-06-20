import { CLOSER_QUESTION_POOL } from "@/data/closerQuestions";
import { hashString } from "@/lib/dailySeed";
import type { CloserPuzzle, CloserScore } from "@/games/closer/types";

export function getCloserQuestionPool() {
  return CLOSER_QUESTION_POOL;
}

export function validateCloserPuzzle(puzzle: CloserPuzzle) {
  const errors: string[] = [];
  if (!puzzle.prompt.trim()) errors.push("Prompt is missing.");
  if (!Number.isFinite(puzzle.answer)) errors.push("Answer is not numeric.");
  if (!puzzle.allowNegative && puzzle.answer < 0) errors.push("Negative answer is not allowed.");
  if (!puzzle.unit.trim()) errors.push("Unit is missing.");
  if (!puzzle.sourceNote.trim()) errors.push("Source note is missing.");
  return { valid: errors.length === 0, errors };
}

export function resolveCloserPuzzleForDate(date: string): CloserPuzzle {
  const seed = hashString(`closer:${date}`);
  const template = CLOSER_QUESTION_POOL[seed % CLOSER_QUESTION_POOL.length];
  const puzzle: CloserPuzzle = { gameId: "closer", date, seed, ...template };
  const validation = validateCloserPuzzle(puzzle);
  if (!validation.valid) throw new Error(validation.errors.join(" "));
  return puzzle;
}

export function parseNumericGuess(input: string) {
  const normalized = input.trim().toLowerCase().replace(/[$,%\s,]/g, "");
  if (!normalized) return null;
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)(k|m|b|thousand|million|billion)?$/);
  if (!match) return null;
  const value = Number(match[1]);
  const multipliers: Record<string, number> = {
    k: 1_000, thousand: 1_000,
    m: 1_000_000, million: 1_000_000,
    b: 1_000_000_000, billion: 1_000_000_000
  };
  return value * (multipliers[match[2] ?? ""] ?? 1);
}

export const normalizeNumericGuess = parseNumericGuess;

export function calculateCloserScore(guess: number, answer: number): CloserScore {
  const distanceFromAnswer = Math.abs(guess - answer);
  const percentError = answer === 0 ? (distanceFromAnswer === 0 ? 0 : Infinity) : distanceFromAnswer / Math.abs(answer);
  const score =
    percentError <= 0.01 ? 100 :
    percentError <= 0.05 ? 90 :
    percentError <= 0.10 ? 80 :
    percentError <= 0.20 ? 65 :
    percentError <= 0.35 ? 50 :
    percentError <= 0.50 ? 35 :
    percentError <= 0.75 ? 20 : 0;
  const labels: Record<number, string> = {
    100: "Dead on", 90: "Extremely close", 80: "Very close", 65: "Close enough",
    50: "In the ballpark", 35: "A bit off", 20: "Way off", 0: "Not close"
  };
  return { score, percentError, distanceFromAnswer, scoreLabel: labels[score] };
}
