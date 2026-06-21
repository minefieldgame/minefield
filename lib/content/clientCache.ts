import { getGameCacheKey } from "@/lib/date";

const requests = new Map<string, Promise<unknown>>();

export function fetchDailyPuzzle<T>(gameId: string, date: string, url: string): Promise<T> {
  const key = getGameCacheKey(gameId, date);
  const existing = requests.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const request = fetch(url)
    .then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Today’s puzzle could not be generated.");
      if (payload?.date && payload.date !== date) {
        throw new Error(`Puzzle date mismatch: requested ${date}, received ${payload.date}`);
      }
      return payload as T;
    })
    .catch((error) => {
      requests.delete(key);
      throw error;
    });
  requests.set(key, request);
  return request;
}
