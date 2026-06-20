import type { SongGuessSubmission } from "@/types/game";

const VERSION_PHRASES = [
  "from original motion picture soundtrack",
  "original motion picture soundtrack",
  "soundtrack version",
  "deluxe edition",
  "radio edit",
  "single version",
  "album version",
  "main theme",
  "bonus track",
  "remastered",
  "remaster",
  "remix",
  "explicit",
  "clean",
  "stereo",
  "mono",
  "live",
  "deluxe",
  "version",
  "edit"
];

const OPTIONAL_TITLE_WORDS = new Set(["the", "a", "an", "and", "theme", "from"]);
const SAFE_ENSEMBLE_SUFFIX = /^(orchestra|band|chorus|ensemble)(\s+(and\s+)?(orchestra|band|chorus|ensemble))*$/;

export function cleanSongTitle(value: string) {
  let cleaned = value
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\b(feat(?:uring)?|ft)\.?\b.*$/i, " ");
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
    .replace(/\b(feat(?:uring)?|ft|with)\.?\b.*$/i, " ")
    .replace(/,\s*(his|her|their)\s+(orchestra|band|chorus).*$/i, "")
    .replace(/\s+(and|&)\s+(his|her|their)\s+(orchestra|band|chorus).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePlain(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalWord(word: string) {
  if (word.length > 4 && word.endsWith("ing")) return word.slice(0, -1);
  return word;
}

export function normalizeMusicString(value: string) {
  return normalizePlain(cleanSongTitle(value))
    .split(" ")
    .map(canonicalWord)
    .join(" ");
}

export function normalizeArtist(value: string) {
  return normalizePlain(cleanArtistName(value)).replace(/^the\s+/, "");
}

function meaningfulWords(value: string) {
  return normalizeMusicString(value)
    .split(" ")
    .filter((word) => word && !OPTIONAL_TITLE_WORDS.has(word));
}

function titleMatches(guess: string, correct: string) {
  const normalizedGuess = normalizeMusicString(guess);
  const normalizedCorrect = normalizeMusicString(correct);
  if (!normalizedGuess) return false;
  if (normalizedGuess === normalizedCorrect) return true;

  const guessWords = meaningfulWords(guess);
  const correctWords = meaningfulWords(correct);
  if (guessWords.join(" ") === correctWords.join(" ")) return true;
  const guessSet = new Set(guessWords);
  const correctSet = new Set(correctWords);
  const containsCore = correctWords.every((word) => guessSet.has(word));
  return correctSet.size >= 2 && containsCore && guessSet.size <= correctSet.size + 2;
}

function artistMatches(guess: string, correct: string) {
  const normalizedGuess = normalizeArtist(guess);
  const normalizedCorrect = normalizeArtist(correct);
  if (!normalizedGuess || !normalizedCorrect) return false;
  if (normalizedGuess === normalizedCorrect) return true;
  if (normalizedGuess.startsWith(`${normalizedCorrect} `)) {
    const suffix = normalizedGuess.slice(normalizedCorrect.length).trim();
    return SAFE_ENSEMBLE_SUFFIX.test(suffix);
  }
  return false;
}

export function parseSongGuess(value: string): SongGuessSubmission {
  const trimmed = value.trim();
  const byMatch = trimmed.match(/^(.*?)\s+by\s+(.+)$/i);
  if (byMatch) {
    return { displayValue: trimmed, title: byMatch[1].trim(), artist: byMatch[2].trim(), selectedAutocomplete: false };
  }
  const separators = [" — ", " – ", " - "];
  for (const separator of separators) {
    const index = trimmed.lastIndexOf(separator);
    if (index > 0) {
      return {
        displayValue: trimmed,
        title: trimmed.slice(0, index).trim(),
        artist: trimmed.slice(index + separator.length).trim(),
        selectedAutocomplete: false
      };
    }
  }
  return { displayValue: trimmed, title: trimmed, artist: "", selectedAutocomplete: false };
}

export type GuessExplanation = {
  correct: boolean;
  rawGuessTitle: string;
  rawGuessArtist: string;
  normalizedGuessTitle: string;
  normalizedGuessArtist: string;
  normalizedCorrectTitle: string;
  normalizedCorrectArtist: string;
  titleMatch: boolean;
  artistMatch: boolean;
  reason: string;
};

export function explainNeedleDropGuess(
  guess: SongGuessSubmission | string,
  correctTitle: string,
  correctArtist = ""
): GuessExplanation {
  const submission = typeof guess === "string" ? parseSongGuess(guess) : guess;
  const titleMatch = titleMatches(submission.title, correctTitle);
  const artistMatch = artistMatches(submission.artist, correctArtist);
  let reason = "The core title and main artist both match.";
  if (!submission.artist.trim()) reason = "Artist is required. Choose an autocomplete result or enter “Song — Artist”.";
  else if (!titleMatch && !artistMatch) reason = "Both the core song title and main artist differ from today’s answer.";
  else if (!titleMatch) reason = "The main artist matches, but the core song title does not.";
  else if (!artistMatch) reason = "The core title matches, but the main artist is different.";
  return {
    correct: titleMatch && artistMatch,
    rawGuessTitle: submission.title,
    rawGuessArtist: submission.artist,
    normalizedGuessTitle: normalizeMusicString(submission.title),
    normalizedGuessArtist: normalizeArtist(submission.artist),
    normalizedCorrectTitle: normalizeMusicString(correctTitle),
    normalizedCorrectArtist: normalizeArtist(correctArtist),
    titleMatch,
    artistMatch,
    reason
  };
}

export function isCorrectGuess(
  guess: SongGuessSubmission | string,
  title: string,
  artist: string
) {
  return explainNeedleDropGuess(guess, title, artist).correct;
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
