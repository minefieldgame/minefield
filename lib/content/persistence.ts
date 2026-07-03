import "server-only";

import usedContentSeed from "@/data/usedContentRegistry.seed.json";
import type { UsedContentRecord } from "@/lib/content/usedContentRegistry";

const memoryStore = new Map<string, unknown>();
const usedContentRecords = new Map<string, UsedContentRecord>(
  (usedContentSeed as UsedContentRecord[]).map((record) => [record.uniqueContentKey, record])
);

export const puzzlePersistenceStatus = {
  provider: "json-seeded-memory",
  durableAcrossDeployments: false,
  note: "MVP provider bootstraps from data/usedContentRegistry.seed.json and stores runtime records in memory. Deterministic seeds keep same-day puzzles stable when memory is cleared; swap this module for database persistence later."
};

function key(gameId: string, dateKey: string) {
  return `${gameId}:${dateKey}`;
}

export async function getPersistedPuzzle<T>(gameId: string, dateKey: string): Promise<T | null> {
  return (memoryStore.get(key(gameId, dateKey)) as T | undefined) ?? null;
}

export async function savePersistedPuzzle<T>(gameId: string, dateKey: string, puzzle: T): Promise<T> {
  memoryStore.set(key(gameId, dateKey), puzzle);
  return puzzle;
}

export async function getUsedContentRecords() {
  return [...usedContentRecords.values()];
}

export async function saveUsedContentRecord(record: UsedContentRecord) {
  usedContentRecords.set(record.uniqueContentKey, record);
  return record;
}

export async function hasUsedContentKey(uniqueContentKey: string) {
  return usedContentRecords.has(uniqueContentKey);
}
