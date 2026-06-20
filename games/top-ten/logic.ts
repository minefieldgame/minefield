import type { TopTenAnswer, TopTenPuzzle } from "@/games/top-ten/types";

const METADATA = [
  "official music video", "official video", "music video", "lyric video", "lyrics",
  "full video", "kids songs", "nursery rhymes", "remastered", "visualizer",
  "soundtrack", "featuring", "version", "episode", "remix", "official", "audio",
  "live", "feat", "ft", "4k", "hd"
];

export function normalizeAnswer(value: string) {
  let normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)|\[[^\]]*]/g, " ")
    .replace(/&/g, " and ")
    .toLowerCase();
  for (const phrase of METADATA) {
    normalized = normalized.replace(new RegExp(`\\b${phrase.replace(/\s+/g, "\\s+")}\\b`, "gi"), " ");
  }
  return normalized
    .replace(/\bfrom\b.*$/i, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return normalizeAnswer(value).split(" ").filter((token) => token.length > 1);
}

function scoreMatch(guess: string, candidate: string) {
  const normalizedGuess = normalizeAnswer(guess);
  const normalizedCandidate = normalizeAnswer(candidate);
  if (!normalizedGuess || !normalizedCandidate) return 0;
  if (normalizedGuess === normalizedCandidate) return 1;
  const guessTokens = tokens(guess);
  const candidateTokens = tokens(candidate);
  if (!guessTokens.length || !candidateTokens.length) return 0;
  const candidateSet = new Set(candidateTokens);
  const intersection = guessTokens.filter((token) => candidateSet.has(token)).length;
  const union = new Set([...guessTokens, ...candidateTokens]).size;
  const jaccard = intersection / union;
  const containment = intersection / Math.min(guessTokens.length, candidateTokens.length);
  const safePartial =
    containment === 1 &&
    (Math.min(guessTokens.length, candidateTokens.length) >= 2 ||
      (guessTokens.length === 1 && guessTokens[0].length >= 7));
  return safePartial ? Math.max(0.88, jaccard) : Math.max(jaccard, containment * 0.82);
}

export type TopTenMatchDiagnostic = {
  rawGuess: string;
  normalizedGuess: string;
  canonicalAnswer: string;
  displayAnswer: string;
  aliasesChecked: string[];
  normalizedAliases: string[];
  matchScore: number;
  accepted: boolean;
  rejectionReason: string;
};

export function diagnoseTopTenAnswer(guess: string, answer: TopTenAnswer): TopTenMatchDiagnostic {
  const aliasesChecked = [...new Set([
    answer.name,
    answer.displayAnswer,
    answer.simplifiedTitle,
    ...answer.aliases
  ].filter(Boolean))];
  const scored = aliasesChecked.map((alias) => ({
    alias,
    score: scoreMatch(guess, alias)
  }));
  const best = scored.reduce((current, item) => item.score > current.score ? item : current, {
    alias: "",
    score: 0
  });
  const accepted = best.score >= 0.86;
  return {
    rawGuess: guess,
    normalizedGuess: normalizeAnswer(guess),
    canonicalAnswer: answer.name,
    displayAnswer: answer.displayAnswer || answer.name,
    aliasesChecked,
    normalizedAliases: aliasesChecked.map(normalizeAnswer),
    matchScore: best.score,
    accepted,
    rejectionReason: accepted
      ? ""
      : best.score > 0.55
        ? "The guess was related but not specific enough."
        : "The guess did not match the answer or its accepted short names."
  };
}

export function checkTopTenAnswer(guess: string, puzzle: TopTenPuzzle, found: string[]) {
  const candidates = puzzle.answers
    .filter((answer) => !found.includes(answer.name))
    .map((answer) => ({ answer, diagnostic: diagnoseTopTenAnswer(guess, answer) }))
    .sort((left, right) => right.diagnostic.matchScore - left.diagnostic.matchScore);
  return candidates[0]?.diagnostic.accepted ? candidates[0].answer.name : null;
}

export function diagnoseTopTenGuess(guess: string, puzzle: TopTenPuzzle) {
  return puzzle.answers
    .map((answer) => diagnoseTopTenAnswer(guess, answer))
    .sort((left, right) => right.matchScore - left.matchScore);
}

export function topTenScore(found: string[]) {
  return found.length >= 3 ? 100 : found.length * 33;
}
