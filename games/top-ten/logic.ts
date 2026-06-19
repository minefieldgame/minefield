import type { TopTenAnswer, TopTenPuzzle } from "@/games/top-ten/types";

export function normalizeAnswer(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buildAliasMap(answers: TopTenAnswer[]) {
  const aliases = new Map<string, string>();
  for (const answer of answers) {
    for (const value of [answer.name, ...answer.aliases]) {
      aliases.set(normalizeAnswer(value), answer.name);
    }
  }
  return aliases;
}

export function checkTopTenAnswer(
  guess: string,
  puzzle: TopTenPuzzle,
  found: string[]
) {
  const match = buildAliasMap(puzzle.answers).get(normalizeAnswer(guess));
  if (!match || found.includes(match)) return null;
  return match;
}

export function topTenScore(found: string[]) {
  return found.length * 10;
}
