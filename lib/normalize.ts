const VERSION_PHRASES = [
  "from original motion picture soundtrack",
  "original motion picture soundtrack",
  "deluxe edition",
  "radio edit",
  "single version",
  "album version",
  "main theme",
  "bonus track",
  "remastered",
  "remaster",
  "explicit",
  "clean",
  "stereo",
  "mono",
  "live",
  "version",
  "edit"
];

const OPTIONAL_TITLE_WORDS = new Set(["the", "a", "an", "and", "theme", "from"]);

export function cleanSongTitle(value: string) {
  let cleaned = value
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\s[-–—:]\s.*$/u, " ");
  for (const phrase of VERSION_PHRASES) {
    cleaned = cleaned.replace(new RegExp(`\\b${phrase}\\b`, "gi"), " ");
  }
  return cleaned
    .replace(/^\s*theme\s+from\s+/i, "")
    .replace(/\s+/g, " ")
    .replace(/[\s\-–—:;,]+$/u, "")
    .trim();
}

export function cleanArtistName(value: string) {
  return value
    .replace(/,\s*(his|her|their)\s+(orchestra|band|chorus).*$/i, "")
    .replace(/\s+(and|&)\s+(his|her|their)\s+(orchestra|band|chorus).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalWord(word: string) {
  if (word.length > 4 && word.endsWith("ing")) return `${word.slice(0, -1)}`;
  return word;
}

export function normalizeMusicString(value: string) {
  return cleanSongTitle(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/\b(feat(?:uring)?|ft)\.?\b.*$/i, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map(canonicalWord)
    .join(" ");
}

function meaningfulWords(value: string) {
  return normalizeMusicString(value)
    .split(" ")
    .filter((word) => word && !OPTIONAL_TITLE_WORDS.has(word));
}

export type GuessExplanation = {
  correct: boolean;
  normalizedGuess: string;
  normalizedTitle: string;
  reason: string;
};

export function explainNeedleDropGuess(guess: string, title: string): GuessExplanation {
  const normalizedGuess = normalizeMusicString(guess);
  const normalizedTitle = normalizeMusicString(title);
  if (!normalizedGuess) {
    return { correct: false, normalizedGuess, normalizedTitle, reason: "The guess is empty after normalization." };
  }
  if (normalizedGuess === normalizedTitle) {
    return { correct: true, normalizedGuess, normalizedTitle, reason: "The cleaned core titles match exactly." };
  }

  const guessWords = meaningfulWords(guess);
  const titleWords = meaningfulWords(title);
  const guessKey = guessWords.join(" ");
  const titleKey = titleWords.join(" ");
  if (guessKey && guessKey === titleKey) {
    return {
      correct: true,
      normalizedGuess,
      normalizedTitle,
      reason: "The meaningful title words match after ignoring articles, conjunctions, and theme/version metadata."
    };
  }

  const guessSet = new Set(guessWords);
  const titleSet = new Set(titleWords);
  const shared = titleWords.filter((word) => guessSet.has(word)).length;
  const coverage = shared / Math.max(titleSet.size, 1);
  const correct = titleSet.size >= 2 && coverage === 1 && guessSet.size <= titleSet.size + 2;
  return {
    correct,
    normalizedGuess,
    normalizedTitle,
    reason: correct
      ? "The guess contains the complete core title with only harmless extra words."
      : `Core-title coverage was ${Math.round(coverage * 100)}%; all meaningful title words are required.`
  };
}

export function isCorrectGuess(guess: string, title: string, _artist?: string) {
  return explainNeedleDropGuess(guess, title).correct;
}

export function similarity(left: string, right: string) {
  const a = normalizeMusicString(left);
  const b = normalizeMusicString(right);
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.82;
  const aWords = new Set(a.split(" "));
  const bWords = new Set(b.split(" "));
  const intersection = [...aWords].filter((word) => bWords.has(word)).length;
  return intersection / Math.max(aWords.size, bWords.size, 1);
}
