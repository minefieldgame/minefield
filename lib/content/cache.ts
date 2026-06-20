type CacheEntry<T> = { value: T; createdAt: number };

const memoryCache = new Map<string, CacheEntry<unknown>>();
const MAX_AGE_MS = 36 * 60 * 60 * 1000;

export function getCachedContent<T>(key: string) {
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.createdAt > MAX_AGE_MS) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheContent<T>(key: string, value: T) {
  memoryCache.set(key, { value, createdAt: Date.now() });
  return value;
}

export function clearCachedContent(key: string) {
  memoryCache.delete(key);
}
