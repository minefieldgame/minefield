import { NextRequest, NextResponse } from "next/server";
import { resolveRankedTop10ForDate, getTopTenProviderStatus, validateTopTenPuzzle } from "@/games/top-ten/providers";
import { resolveSpellDropForDate } from "@/games/spelldrop/providers";
import { resolveCloserForDate } from "@/games/closer/providers";
import { resolveMinefieldPuzzle } from "@/games/minefield/logic";
import { resolveLandmarkDropPuzzle, resolveMeetMeHalfwayPuzzle } from "@/games/geography/puzzles";
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_VALUE } from "@/lib/adminAuth";
import { getAIStatus } from "@/lib/content/aiClient";
import { hashString } from "@/lib/dailySeed";
import { getGameCacheKey, getPacificDateKey } from "@/lib/date";
import { resolveNeedleDropDiagnostic } from "@/lib/needledropResolver";
import {
  classifyDynamicError,
  dynamicResolverDiagnostics,
  type DynamicGameId
} from "@/lib/content/dynamicErrors";

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
  const dynamicError = (gameId: DynamicGameId, route: string, reason: unknown) => {
    const classified = classifyDynamicError(reason);
    const resolverDiagnostics = {
      ...dynamicResolverDiagnostics(gameId, date, route),
      cacheHit: false,
      errorType: classified.errorType,
      errorMessage: classified.message
    };
    return {
    status: "error" as const,
    error: classified.message,
    diagnostics: {
      ...aiStatus,
      generationStatus: "failed" as const,
      validationStatus: "not-run" as const,
      sourceData: [],
      contentHash: null,
      fallbackUsed: false as const,
      errors: [classified.message],
      resolverDiagnostics
    }
  };
  };

  const [needledropResult, topTenResult, spellDropResult, closerResult] = await Promise.allSettled([
    resolveNeedleDropDiagnostic(date),
    resolveRankedTop10ForDate(date, {
      force: topTenRetry > 0 || force,
      retryOffset: topTenRetry
    }),
    resolveSpellDropForDate(date, force),
    resolveCloserForDate(date, force)
  ]);

  const needledrop = needledropResult.status === "fulfilled"
    ? { status: "ready" as const, ...needledropResult.value }
    : { status: "error" as const, error: needledropResult.reason instanceof Error ? needledropResult.reason.message : "NeedleDrop failed." };

  const topTenFailure = topTenResult.status === "rejected"
    ? classifyDynamicError(topTenResult.reason)
    : null;
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
          errors: topTenResult.value.validation.errors,
          resolverDiagnostics: {
            ...dynamicResolverDiagnostics("ranked-top-10", date, "/api/top-ten/generate"),
            cacheHit: Boolean(topTenResult.value.cacheHit),
            generatedAt: topTenResult.value.generatedAt
          }
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
          errors: [topTenResult.reason instanceof Error ? topTenResult.reason.message : "Unknown failure."],
          resolverDiagnostics: {
            ...dynamicResolverDiagnostics("ranked-top-10", date, "/api/top-ten/generate"),
            cacheHit: false,
            errorType: topTenFailure?.errorType,
            errorMessage: topTenFailure?.message
          }
        }
      };

  const spellDrop = spellDropResult.status === "fulfilled"
    ? {
        status: "ready" as const,
        ...spellDropResult.value,
        diagnostics: {
          ...dynamicResolverDiagnostics("spelldrop", date, "/api/spelldrop"),
          cacheHit: spellDropResult.value.cacheHit,
          generatedAt: spellDropResult.value.generatedAt
        }
      }
    : dynamicError("spelldrop", "/api/spelldrop", spellDropResult.reason);
  const closer = closerResult.status === "fulfilled"
    ? {
        status: "ready" as const,
        ...closerResult.value,
        diagnostics: {
          ...dynamicResolverDiagnostics("closer", date, "/api/closer"),
          cacheHit: closerResult.value.cacheHit,
          generatedAt: closerResult.value.generatedAt
        }
      }
    : dynamicError("closer", "/api/closer", closerResult.reason);

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
