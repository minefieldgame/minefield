import type { OddOneOutApiPayload, OddOneOutPuzzle } from "@/games/odd-one-out/types";

export function normalizeOddOneOutItem(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

export function unwrapOddOneOutPayload(payload: OddOneOutApiPayload): OddOneOutPuzzle {
  return "puzzle" in payload ? payload.puzzle : payload;
}

export function assertPlayableOddOneOutPuzzle(
  payload: OddOneOutApiPayload,
  expectedDate: string
): OddOneOutPuzzle {
  const puzzle = unwrapOddOneOutPayload(payload);
  if (puzzle.gameId !== "odd-one-out" || puzzle.date !== expectedDate) {
    throw new Error("Odd One Out returned the wrong game or date.");
  }
  if (!puzzle.id || !puzzle.prompt?.trim() || !puzzle.explanation?.trim()) {
    throw new Error("Odd One Out returned incomplete puzzle copy.");
  }
  if (!Array.isArray(puzzle.items) || puzzle.items.length !== 5) {
    throw new Error("Odd One Out requires exactly five items.");
  }
  const normalizedItems = puzzle.items.map(normalizeOddOneOutItem);
  if (normalizedItems.some((item) => !item) || new Set(normalizedItems).size !== 5) {
    throw new Error("Odd One Out requires five unique, non-empty items.");
  }
  const answerIndex = normalizedItems.indexOf(normalizeOddOneOutItem(puzzle.answer));
  if (answerIndex === -1) {
    throw new Error("Odd One Out answer must be one of the five items.");
  }
  return {
    ...puzzle,
    prompt: puzzle.prompt.trim(),
    explanation: puzzle.explanation.trim(),
    items: puzzle.items.map((item) => item.trim()),
    answer: puzzle.items[answerIndex].trim()
  };
}
