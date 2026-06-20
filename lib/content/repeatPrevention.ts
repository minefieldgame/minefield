import { hashString } from "@/lib/dailySeed";

export type ContentHistoryEntry = {
  gameId: string;
  contentHash: string;
  topic: string;
  answer: string;
  date: string;
};

const STORAGE_KEY = "minefield:content-history:v1";
const serverHistory: ContentHistoryEntry[] = [];

export function generateContentHash(value: unknown) {
  return hashString(JSON.stringify(value)).toString(16).padStart(8, "0");
}

function readHistory() {
  if (typeof window === "undefined") return serverHistory;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as ContentHistoryEntry[];
  } catch {
    return [];
  }
}

export function hasRecentlyAppeared(gameId: string, contentHash: string, lookback = 45) {
  return readHistory()
    .filter((entry) => entry.gameId === gameId)
    .slice(0, lookback)
    .some((entry) => entry.contentHash === contentHash);
}

export function avoidRecentTopics(gameId: string, topics: string[], lookback = 7) {
  const recent = new Set(
    readHistory()
      .filter((entry) => entry.gameId === gameId)
      .slice(0, lookback)
      .map((entry) => entry.topic.toLowerCase())
  );
  return topics.filter((topic) => !recent.has(topic.toLowerCase()));
}

export function markContentUsed(entry: ContentHistoryEntry) {
  if (typeof window === "undefined") {
    if (!serverHistory.some((item) => item.gameId === entry.gameId && item.date === entry.date)) {
      serverHistory.unshift(entry);
      serverHistory.splice(180);
    }
    return;
  }
  const history = readHistory().filter(
    (item) => !(item.gameId === entry.gameId && item.date === entry.date)
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...history].slice(0, 180)));
}
