const requests = new Map<string, Promise<unknown>>();

export function fetchDailyPuzzle<T>(gameId: string, date: string, url: string): Promise<T> {
  const key = `${gameId}:${date}`;
  const existing = requests.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const request = fetch(url)
    .then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Today’s puzzle could not be generated.");
      return payload as T;
    })
    .catch((error) => {
      requests.delete(key);
      throw error;
    });
  requests.set(key, request);
  return request;
}
