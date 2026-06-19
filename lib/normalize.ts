const VERSION_WORDS =
  /\b(remaster(?:ed)?|radio edit|single version|album version|mono|stereo|edit|version|live|bonus track|explicit|clean)\b/gi;

export function normalizeMusicString(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\b(feat(?:uring)?|ft)\.?\b.*$/i, " ")
    .replace(VERSION_WORDS, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isCorrectGuess(guess: string, title: string, artist: string) {
  const normalizedGuess = normalizeMusicString(guess);
  const normalizedTitle = normalizeMusicString(title);
  const normalizedArtist = normalizeMusicString(artist);
  if (!normalizedGuess) return false;
  if (normalizedGuess === normalizedTitle) return true;
  return (
    normalizedGuess === `${normalizedTitle} ${normalizedArtist}` ||
    normalizedGuess === `${normalizedTitle} by ${normalizedArtist}` ||
    normalizedGuess.startsWith(`${normalizedTitle} `) &&
      normalizedGuess.includes(normalizedArtist)
  );
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
