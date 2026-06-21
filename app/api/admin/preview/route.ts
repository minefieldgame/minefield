import { NextRequest, NextResponse } from "next/server";
import { resolveDailyTopTenPuzzle, getTopTenProviderStatus, validateTopTenPuzzle } from "@/games/top-ten/providers";
import { resolveDailySpellDropPuzzle } from "@/games/spelldrop/providers";
import { resolveDailyCloserPuzzle } from "@/games/closer/providers";
import { resolveMinefieldPuzzle } from "@/games/minefield/logic";
import { resolveLandmarkDropPuzzle, resolveMeetMeHalfwayPuzzle } from "@/games/geography/puzzles";
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_VALUE } from "@/lib/adminAuth";
import { getAIStatus } from "@/lib/content/aiClient";
import { hashString } from "@/lib/dailySeed";
import { getGameCacheKey, getPacificDateKey } from "@/lib/date";
import { resolveNeedleDropDiagnostic } from "@/lib/needledropResolver";
import type { GeneratedContentEnvelope } from "@/lib/content/dailyContentEngine";
import type { SpellDropPuzzle } from "@/games/spelldrop/types";
import type { CloserPuzzle } from "@/games/closer/types";
import type { RankedTopTenPuzzle } from "@/games/top-ten/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (request.cookies.get(ADMIN_COOKIE_NAME)?.value !== ADMIN_SESSION_VALUE) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const selected = request.nextUrl.searchParams.get("date");
  const date = selected && /^\d{4}-\d{2}-\d{2}$/.test(selected) ? selected : getPacificDateKey();
  const topTenRetry = Number(request.nextUrl.searchParams.get("topTenRetry") ?? 0);
  const force = request.nextUrl.searchParams.get("force") === "1";
  const aiStatus = getAIStatus();
  const dynamicError = (reason: unknown) => {
    const message = reason instanceof Error ? reason.message : "Generation failed.";
    return {
    status: "error" as const,
    error: message,
    diagnostics: {
      ...aiStatus,
      generationStatus: "failed" as const,
      validationStatus: "not-run" as const,
      sourceData: [],
      contentHash: null,
      fallbackUsed: false as const,
      errors: [message]
    }
  };
  };

  async function fetchCanonical<T>(path: string) {
    const response = await fetch(`${request.nextUrl.origin}${path}?date=${date}`, { cache: "force-cache" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? `${path} failed.`);
    const cacheSignal = [
      response.headers.get("x-cache"),
      response.headers.get("x-vercel-cache"),
      response.headers.get("cf-cache-status"),
      response.headers.get("x-amz-cf-cache-status"),
      response.headers.get("age")
    ].filter(Boolean).join(" ");
    if (payload && typeof payload === "object") {
      payload.cacheHit = Boolean(payload.cacheHit || /\bhit\b/i.test(cacheSignal) || Number(response.headers.get("age") ?? 0) > 0);
    }
    return payload as T;
  }

  const [needledropResult, topTenResult, spellDropResult, closerResult] = await Promise.allSettled([
    resolveNeedleDropDiagnostic(date),
    force || topTenRetry > 0
      ? resolveDailyTopTenPuzzle(date, { force: true, retryOffset: topTenRetry })
      : fetchCanonical<RankedTopTenPuzzle>("/api/top-ten/generate"),
    force
      ? resolveDailySpellDropPuzzle(date, true)
      : fetchCanonical<GeneratedContentEnvelope<SpellDropPuzzle> & SpellDropPuzzle>("/api/spelldrop"),
    force
      ? resolveDailyCloserPuzzle(date, true)
      : fetchCanonical<GeneratedContentEnvelope<CloserPuzzle> & CloserPuzzle>("/api/closer")
  ]);

  const needledrop = needledropResult.status === "fulfilled"
    ? { status: "ready" as const, ...needledropResult.value }
    : { status: "error" as const, error: needledropResult.reason instanceof Error ? needledropResult.reason.message : "NeedleDrop failed." };

  const providerStatus = getTopTenProviderStatus();
  const topTen = topTenResult.status === "fulfilled"
    ? {
        status: "ready" as const,
        puzzle: topTenResult.value,
        diagnostics: {
          sourceProvider: topTenResult.value.generator ?? "OpenAI Responses API + web search",
          validationStatus: validateTopTenPuzzle(topTenResult.value).valid ? "valid" : "invalid",
          dataFreshness: `Generated ${topTenResult.value.generatedAt}`,
          confidence: topTenResult.value.confidence,
          generationMode: "live-ai",
          apiKeyConfigured: providerStatus.apiKeyConfigured,
          warning: providerStatus.warning,
          errors: topTenResult.value.validation.errors
        },
        rawProviderResponse: topTenResult.value.rawAIResponse
      }
    : {
        status: "error" as const,
        error: topTenResult.reason instanceof Error ? topTenResult.reason.message : "Top 10 failed.",
        diagnostics: {
          apiKeyConfigured: providerStatus.apiKeyConfigured,
          liveAIEnabled: providerStatus.mode === "live-ai",
          model: providerStatus.model,
          generationMode: providerStatus.mode,
          failureReason: topTenResult.reason instanceof Error ? topTenResult.reason.message : "Unknown failure.",
          generationStatus: "failed" as const,
          validationStatus: "not-run" as const,
          sourceData: [],
          contentHash: null,
          fallbackUsed: false as const,
          errors: [topTenResult.reason instanceof Error ? topTenResult.reason.message : "Unknown failure."]
        }
      };

  const spellDrop = spellDropResult.status === "fulfilled"
    ? { status: "ready" as const, ...spellDropResult.value }
    : dynamicError(spellDropResult.reason);
  const closer = closerResult.status === "fulfilled"
    ? { status: "ready" as const, ...closerResult.value }
    : dynamicError(closerResult.reason);

  const dailySeed = hashString(`minefield:${date}`);
  return NextResponse.json({
    date,
    pacificDate: getPacificDateKey(),
    cacheKeys: {
      rankedTopTen: getGameCacheKey("ranked-top-10", date),
      spellDrop: getGameCacheKey("spelldrop", date),
      closer: getGameCacheKey("closer", date)
    },
    dailySeed,
    seedHash: dailySeed.toString(16).padStart(8, "0"),
    generatedAt: new Date().toISOString(),
    games: {
      needledrop,
      minefield: { status: "ready", puzzle: resolveMinefieldPuzzle(date, 480, 600) },
      topTen,
      spellDrop,
      closer,
      meetMeHalfway: { status: "ready", puzzle: resolveMeetMeHalfwayPuzzle(date) },
      landmarkDrop: { status: "ready", puzzle: resolveLandmarkDropPuzzle(date), imageStatus: "Loaded client-side with graceful fallback" }
    }
  }, { headers: { "Cache-Control": "no-store" } });
}
