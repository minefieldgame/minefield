import "server-only";

import { unstable_cache } from "next/cache";
import { resolveDailyTopTenPuzzle } from "@/games/top-ten/providers";
import { resolveDailySpellDropPuzzle } from "@/games/spelldrop/providers";
import { resolveDailyCloserPuzzle } from "@/games/closer/providers";
import { resolveNeedleDropDiagnostic } from "@/lib/needledropResolver";
import type { RankedTopTenPuzzle } from "@/games/top-ten/types";
import type { SpellDropPuzzle } from "@/games/spelldrop/types";
import type { CloserPuzzle } from "@/games/closer/types";
import type { GeneratedContentEnvelope } from "@/lib/content/dailyContentEngine";

const CACHE_SECONDS = 60 * 60 * 24 * 370;

const cachedRankedTop5 = unstable_cache(
  async (date: string) => resolveDailyTopTenPuzzle(date),
  ["minefield-daily-ranked-top-5-v1"],
  { revalidate: CACHE_SECONDS, tags: ["minefield-daily-ranked-top-5"] }
);

const cachedSpellDrop = unstable_cache(
  async (date: string) => resolveDailySpellDropPuzzle(date),
  ["minefield-daily-spelldrop-v1"],
  { revalidate: CACHE_SECONDS, tags: ["minefield-daily-spelldrop"] }
);

const cachedCloser = unstable_cache(
  async (date: string) => resolveDailyCloserPuzzle(date),
  ["minefield-daily-closer-v1"],
  { revalidate: CACHE_SECONDS, tags: ["minefield-daily-closer"] }
);

const cachedNeedleDrop = unstable_cache(
  async (date: string) => resolveNeedleDropDiagnostic(date),
  ["minefield-daily-needledrop-v1"],
  { revalidate: CACHE_SECONDS, tags: ["minefield-daily-needledrop"] }
);

function withObservedCacheHit<T extends { generatedAt: string; generationDurationMs?: number; cacheHit?: boolean }>(
  value: T
): T & { cacheHit: boolean } {
  const age = Date.now() - Date.parse(value.generatedAt);
  return {
    ...value,
    cacheHit: Boolean(value.cacheHit) || age > Math.max(1000, (value.generationDurationMs ?? 0) + 500)
  };
}

export async function resolveRankedTop5ForDate(
  date: string,
  options: Parameters<typeof resolveDailyTopTenPuzzle>[1] = {}
): Promise<RankedTopTenPuzzle> {
  if (options.force) return resolveDailyTopTenPuzzle(date, options);
  return withObservedCacheHit(await cachedRankedTop5(date));
}

export async function resolveSpellDropForDate(
  date: string,
  force = false
): Promise<GeneratedContentEnvelope<SpellDropPuzzle>> {
  if (force) return resolveDailySpellDropPuzzle(date, true);
  return withObservedCacheHit(await cachedSpellDrop(date));
}

export async function resolveCloserForDate(
  date: string,
  force = false
): Promise<GeneratedContentEnvelope<CloserPuzzle>> {
  if (force) return resolveDailyCloserPuzzle(date, true);
  return withObservedCacheHit(await cachedCloser(date));
}

export async function resolveNeedleDropForDate(date: string) {
  return cachedNeedleDrop(date);
}
