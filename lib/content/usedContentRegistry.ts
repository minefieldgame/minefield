import { GAME_VERSIONS, createSeededRandom, getGameSeedForDate, hashString, type SeededGameId } from "@/lib/dailySeed";

export type UsedContentRecord = {
  gameId: string;
  date: string;
  contentType: string;
  normalizedPrompt: string;
  normalizedAnswer: string;
  uniqueContentKey: string;
  sourceMetadata?: Record<string, unknown>;
  createdAt: string;
};

export type DuplicateCheckResult = {
  uniqueContentKey: string;
  duplicateDetected: boolean;
  passed: boolean;
  regenerationCount: number;
  retryCount: number;
  exhaustedCandidatePool: boolean;
  checkedAgainstCount: number;
  recentlyUsedKeys: string[];
  warning?: string;
};

const DATE_EPOCH = "2026-01-01";
const ARTICLES = new Set(["a", "an", "the"]);

function dateFromKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`);
}

function shiftDate(dateKey: string, days: number) {
  const date = dateFromKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(startDateKey: string, endDateKey: string) {
  return Math.max(0, Math.floor((Date.parse(`${endDateKey}T12:00:00Z`) - Date.parse(`${startDateKey}T12:00:00Z`)) / 86_400_000));
}

export function normalizeUsedContentText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word && !ARTICLES.has(word))
    .join(" ")
    .trim();
}

export function createUniqueContentKey(gameId: string, contentType: string, parts: Array<string | number>) {
  return [
    gameId,
    contentType,
    ...parts.map((part) => normalizeUsedContentText(String(part)))
  ].filter(Boolean).join(":");
}

export function createMusicUsedContentKey(artist: string, songTitle: string) {
  return createUniqueContentKey("music", "song", [artist, songTitle]);
}

export function createUsedContentRecord(input: {
  gameId: string;
  date: string;
  contentType: string;
  prompt: string;
  answer: string;
  uniqueContentKey: string;
  sourceMetadata?: Record<string, unknown>;
}): UsedContentRecord {
  return {
    gameId: input.gameId,
    date: input.date,
    contentType: input.contentType,
    normalizedPrompt: normalizeUsedContentText(input.prompt),
    normalizedAnswer: normalizeUsedContentText(input.answer),
    uniqueContentKey: input.uniqueContentKey,
    sourceMetadata: input.sourceMetadata,
    createdAt: `${input.date}T12:00:00.000Z`
  };
}

function historicalSelectionKeys<T>({
  gameId,
  dateKey,
  candidates,
  contentKey,
  lookbackDays
}: {
  gameId: SeededGameId;
  dateKey: string;
  candidates: readonly T[];
  contentKey: (candidate: T) => string;
  lookbackDays: number;
}) {
  const allKeys = candidates.map(contentKey);
  const remaining = new Set(allKeys);
  const used: string[] = [];
  const elapsedDays = daysBetween(DATE_EPOCH, dateKey);
  const startOffset = Math.max(0, elapsedDays - lookbackDays);

  for (let offset = 0; offset < elapsedDays; offset += 1) {
    if (!remaining.size) break;
    const historicalDate = shiftDate(DATE_EPOCH, offset);
    const seed = getGameSeedForDate(historicalDate, gameId);
    const availableKeys = [...remaining].sort();
    const selected = createSeededRandom(seed).choice(availableKeys);
    remaining.delete(selected);
    if (offset >= startOffset) used.push(selected);
  }

  return { used, exhaustedBeforeToday: !remaining.size, remaining };
}

export function selectNonRepeatingDailyCandidate<T>({
  gameId,
  dateKey,
  candidates,
  contentKey,
  lookbackDays = 365
}: {
  gameId: SeededGameId;
  dateKey: string;
  candidates: readonly T[];
  contentKey: (candidate: T) => string;
  lookbackDays?: number;
}) {
  if (!candidates.length) throw new Error(`No candidates available for ${gameId}.`);

  const history = historicalSelectionKeys({ gameId, dateKey, candidates, contentKey, lookbackDays });
  const usedSet = new Set(history.used);
  const remainingCandidates = candidates.filter((candidate) => !usedSet.has(contentKey(candidate)));
  const exhaustedCandidatePool = remainingCandidates.length === 0;
  const pool = exhaustedCandidatePool ? candidates : remainingCandidates;
  const seed = getGameSeedForDate(dateKey, gameId);
  const selected = createSeededRandom(seed).choice(pool);
  const uniqueContentKey = contentKey(selected);
  const duplicateDetected = usedSet.has(uniqueContentKey);
  const check: DuplicateCheckResult = {
    uniqueContentKey,
    duplicateDetected,
    passed: !duplicateDetected,
    regenerationCount: duplicateDetected ? Math.min(20, history.used.length) : 0,
    retryCount: duplicateDetected ? Math.min(20, history.used.length) : candidates.length - pool.length,
    exhaustedCandidatePool,
    checkedAgainstCount: history.used.length,
    recentlyUsedKeys: history.used.slice(-20),
    warning: exhaustedCandidatePool
      ? `${gameId} candidate pool exhausted for ${GAME_VERSIONS[gameId]}; add more generated/persisted content to guarantee no repeats.`
      : duplicateDetected
        ? `${gameId} selected a duplicate content key after deterministic fallback attempts.`
        : undefined
  };

  return { selected, check };
}

export function contentHashFromKey(uniqueContentKey: string) {
  return hashString(uniqueContentKey).toString(16).padStart(8, "0");
}
