import { getAIStatus } from "@/lib/content/aiClient";
import { getGameCacheKey } from "@/lib/date";

export type DynamicGameId = "ranked-top-5" | "spelldrop" | "closer";

export type DynamicApiError = {
  ok: false;
  gameId: DynamicGameId;
  date: string;
  errorType: string;
  message: string;
  route: string;
  envDetected: boolean;
  model: string;
  cacheHit: false;
};

export function classifyDynamicError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : "Unknown generation error.";
  if (/OPENAI_API_KEY|api key|missing/i.test(message)) return { errorType: "environment", message };
  if (/validation failed|exactly|duplicate|source/i.test(message)) return { errorType: "validation", message };
  if (/fetch failed|network|ECONN|ENOTFOUND|timeout/i.test(message)) return { errorType: "provider_network", message };
  if (/JSON|structured output|parse/i.test(message)) return { errorType: "provider_response", message };
  return { errorType: "generation", message };
}

export function createDynamicApiError({
  gameId,
  date,
  route,
  reason
}: {
  gameId: DynamicGameId;
  date: string;
  route: string;
  reason: unknown;
}): DynamicApiError {
  const status = getAIStatus();
  const classified = classifyDynamicError(reason);
  return {
    ok: false,
    gameId,
    date,
    errorType: classified.errorType,
    message: classified.message,
    route,
    envDetected: status.apiKeyConfigured,
    model: status.model,
    cacheHit: false
  };
}

export function dynamicResolverDiagnostics(gameId: DynamicGameId, date: string, route: string) {
  const status = getAIStatus();
  return {
    route,
    resolver: gameId === "ranked-top-5"
      ? "resolveRankedTop5ForDate"
      : gameId === "spelldrop"
        ? "resolveSpellDropForDate"
        : "resolveCloserForDate",
    date,
    cacheKey: getGameCacheKey(gameId, date),
    envDetected: status.apiKeyConfigured,
    model: status.model
  };
}
