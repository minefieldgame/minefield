const TYPO_SCORE_THRESHOLD = 1;

function normalizeLyric(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .replace(/\bim\b/g, "i am")
    .replace(/\byoure\b/g, "you are")
    .replace(/\bwere\b/g, "we are")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(left: string, right: string) {
  const a = normalizeLyric(left);
  const b = normalizeLyric(right);
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j += 1) {
    let previous = dp[0];
    dp[0] = j;
    for (let i = 1; i <= a.length; i += 1) {
      const temp = dp[i];
      dp[i] = a[i - 1] === b[j - 1]
        ? previous
        : Math.min(previous + 1, dp[i] + 1, dp[i - 1] + 1);
      previous = temp;
    }
  }
  return dp[a.length];
}

export function scoreSingAlongGuess(guess: string, accepted: string[]) {
  const cleanedGuess = normalizeLyric(guess);
  if (!cleanedGuess) return { score: 0, correct: false, label: "No lyric entered" };

  const normalizedAccepted = accepted.map(normalizeLyric);
  if (normalizedAccepted.includes(cleanedGuess)) {
    return { score: 100, correct: true, label: "Perfect lyric" };
  }

  const bestDistance = Math.min(...accepted.map((value) => levenshtein(guess, value)));
  if (bestDistance <= TYPO_SCORE_THRESHOLD) {
    return { score: 70, correct: true, label: "Minor typo accepted" };
  }

  return { score: 0, correct: false, label: "Incorrect lyric" };
}
