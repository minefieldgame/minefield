import { getGameCacheKey } from "@/lib/date";

const requests = new Map<string, Promise<unknown>>();

export function fetchDailyPuzzle<T>(gameId: string, date: string, url: string): Promise<T> {
  const key = getGameCacheKey(gameId, date);
  const existing = requests.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const request = fetch(url)
    .then(async (response) => {
      const body = await response.text();
      let payload: Record<string, unknown>;
      try {
        payload = body ? JSON.parse(body) as Record<string, unknown> : {};
      } catch {
        throw new Error(`Dynamic puzzle route returned a non-JSON response (${response.status}).`);
      }
      if (!response.ok) {
        throw new Error(
          typeof payload.message === "string"
            ? payload.message
            : "Today’s puzzle could not be loaded."
        );
      }
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
