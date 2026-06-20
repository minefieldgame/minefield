import { DYNAMIC_CONTENT_CACHE_HOURS } from "@/lib/content/config";

type CacheEntry<T> = { value: T; createdAt: number };

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const MAX_AGE_MS = DYNAMIC_CONTENT_CACHE_HOURS * 60 * 60 * 1000;

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

export function getInFlightContent<T>(key: string) {
  return inFlight.get(key) as Promise<T> | undefined;
}

export function setInFlightContent<T>(key: string, promise: Promise<T>) {
  inFlight.set(key, promise);
  promise.finally(() => {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  });
  return promise;
}
