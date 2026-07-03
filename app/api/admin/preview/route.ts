import { NextRequest, NextResponse } from "next/server";
import { getTopTenProviderStatus, validateTopTenPuzzle } from "@/games/top-ten/providers";
import {
  resolveCloserForDate,
  resolveNeedleDropForDate,
  resolveRankedTop5ForDate,
  resolveSingAlongForDate,
  resolveSpellDropForDate
} from "@/lib/content/dailyPuzzleResolvers";
import { resolveMinefieldPuzzle } from "@/games/minefield/logic";
import { resolveLandmarkDropPuzzle, resolveMeetMeHalfwayPuzzle } from "@/games/geography/puzzles";
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_VALUE } from "@/lib/adminAuth";
import { getAIStatus } from "@/lib/content/aiClient";
import { buildDailyBoardSeedManifest, getDailyMasterSeed, getGameSeedForDate, hashString, type SeededGameId } from "@/lib/dailySeed";
import { getGameCacheKey, getPacificDateKey } from "@/lib/date";
import {
  classifyDynamicError,
  dynamicResolverDiagnostics,
  type DynamicGameId
} from "@/lib/content/dynamicErrors";
import { puzzlePersistenceStatus } from "@/lib/content/persistence";

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

  const [needledropResult, singAlongResult, topTenResult, spellDropResult, closerResult] = await Promise.allSettled([
    resolveNeedleDropForDate(date),
    resolveSingAlongForDate(date),
    resolveRankedTop5ForDate(date, {
      force: topTenRetry > 0 || force,
      retryOffset: topTenRetry
    }),
    resolveSpellDropForDate(date, force),
    resolveCloserForDate(date, force)
  ]);

  const needledrop = needledropResult.status === "fulfilled"
    ? { status: "ready" as const, ...needledropResult.value }
    : { status: "error" as const, error: needledropResult.reason instanceof Error ? needledropResult.reason.message : "Rewind failed." };

  const singAlong = singAlongResult.status === "fulfilled"
    ? {
        status: "ready" as const,
        puzzle: singAlongResult.value,
        diagnostics: {
          sourceProvider: "Versioned deterministic catalog + iTunes Search API",
          chartDate: singAlongResult.value.chartDate,
          playbackStart: singAlongResult.value.playbackStart,
          playbackStop: singAlongResult.value.playbackStop,
          stopTimestamp: singAlongResult.value.stopTimestamp,
          chorusTimestamp: singAlongResult.value.chorusTimestamp,
          cueDescription: singAlongResult.value.cueDescription,
          choices: singAlongResult.value.choices,
          correctChoiceId: singAlongResult.value.correctChoiceId,
          validationStatus: singAlongResult.value.validation.valid ? "valid" : "invalid",
          contentHash: singAlongResult.value.contentHash,
          generatedAt: singAlongResult.value.generatedAt,
          gameSeed: singAlongResult.value.gameSeed,
          cacheKey: getGameCacheKey("sing-along", date)
        }
      }
    : { status: "error" as const, error: singAlongResult.reason instanceof Error ? singAlongResult.reason.message : "Sing Along failed." };

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
          generationMode: "deterministic-catalog",
          apiKeyConfigured: providerStatus.apiKeyConfigured,
          warning: providerStatus.warning,
          errors: topTenResult.value.validation.errors,
          resolverDiagnostics: {
            ...dynamicResolverDiagnostics("ranked-top-5", date, "/api/top-ten/generate"),
            cacheHit: Boolean(topTenResult.value.cacheHit),
            generatedAt: topTenResult.value.generatedAt
          }
        },
        rawProviderResponse: topTenResult.value.rawAIResponse
      }
    : {
        status: "error" as const,
        error: topTenResult.reason instanceof Error ? topTenResult.reason.message : "In Order failed.",
        diagnostics: {
          apiKeyConfigured: providerStatus.apiKeyConfigured,
          liveAIEnabled: false,
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
            ...dynamicResolverDiagnostics("ranked-top-5", date, "/api/top-ten/generate"),
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

  const dailySeed = getGameSeedForDate(date, "minefield");
  const puzzleHashes: Partial<Record<SeededGameId, string>> = {
    needledrop: needledrop.status === "ready" ? hashString(`${needledrop.puzzle.title}:${needledrop.puzzle.artist}:${needledrop.puzzle.chartDate}`).toString(16) : undefined,
    "sing-along": singAlong.status === "ready" ? singAlong.puzzle.contentHash : undefined,
    "ranked-top-5": topTen.status === "ready" ? topTen.puzzle.contentHash : undefined,
    spelldrop: spellDrop.status === "ready" ? spellDrop.contentHash : undefined,
    closer: closer.status === "ready" ? closer.contentHash : undefined,
    "meet-me-halfway": hashString(JSON.stringify(resolveMeetMeHalfwayPuzzle(date))).toString(16),
    "landmark-drop": hashString(JSON.stringify(resolveLandmarkDropPuzzle(date))).toString(16),
    minefield: hashString(JSON.stringify(resolveMinefieldPuzzle(date, 560, 700))).toString(16)
  };
  const dailyBoard = buildDailyBoardSeedManifest(date, [
    "needledrop",
    "sing-along",
    "ranked-top-5",
    "spelldrop",
    "closer",
    "meet-me-halfway",
    "landmark-drop",
    "minefield"
  ], puzzleHashes, {
    needledrop: "Billboard archive + iTunes Search API",
    "sing-along": "deterministic-catalog+iTunes",
    "ranked-top-5": "deterministic-catalog",
    spelldrop: "deterministic-catalog",
    closer: "deterministic-catalog",
    "meet-me-halfway": "deterministic-seeded-world-cities",
    "landmark-drop": "deterministic-seeded-landmarks",
    minefield: "deterministic-seeded-board"
  });
  return NextResponse.json({
    date,
    pacificDate: getPacificDateKey(),
    masterSeed: getDailyMasterSeed(date),
    dailyBoard,
    persistenceProvider: puzzlePersistenceStatus,
    cacheKeys: {
      rankedTopTen: getGameCacheKey("ranked-top-5", date),
      singAlong: getGameCacheKey("sing-along", date),
      spellDrop: getGameCacheKey("spelldrop", date),
      closer: getGameCacheKey("closer", date)
    },
    dailySeed,
    seedHash: dailySeed.toString(16).padStart(8, "0"),
    generatedAt: new Date().toISOString(),
    games: {
      needledrop,
      singAlong,
      minefield: { status: "ready", puzzle: resolveMinefieldPuzzle(date, 560, 700) },
      topTen,
      spellDrop,
      closer,
      meetMeHalfway: { status: "ready", puzzle: resolveMeetMeHalfwayPuzzle(date) },
      landmarkDrop: { status: "ready", puzzle: resolveLandmarkDropPuzzle(date), imageStatus: "Client image check pending" }
    }
  }, { headers: { "Cache-Control": "no-store" } });
}
