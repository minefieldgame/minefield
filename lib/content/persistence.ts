import "server-only";

const memoryStore = new Map<string, unknown>();

export const puzzlePersistenceStatus = {
  provider: "memory",
  durableAcrossDeployments: false,
  note: "MVP provider. Deterministic seeds keep same-day puzzles stable when memory is cleared; swap this module for database persistence later."
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
