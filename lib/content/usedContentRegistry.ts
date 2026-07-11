import { hashString } from "@/lib/dailySeed";

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

const ARTICLES = new Set(["a", "an", "the"]);

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

export function contentHashFromKey(uniqueContentKey: string) {
  return hashString(uniqueContentKey).toString(16).padStart(8, "0");
}
