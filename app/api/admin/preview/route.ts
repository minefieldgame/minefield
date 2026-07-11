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
import { resolveLandmarkDropForDate, resolveMeetMeHalfwayForDate } from "@/games/geography/serverPuzzles";
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
import { getInventoryOverview } from "@/lib/content/inventoryHealth";

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
          sourceProvider: "Reviewed lyric-timing inventory + staged iTunes preview validation",
          chartDate: singAlongResult.value.chartDate,
          playbackStart: singAlongResult.value.playbackStart,
          playbackStop: singAlongResult.value.playbackStop,
          stopTimestamp: singAlongResult.value.stopTimestamp,
          chorusTimestamp: singAlongResult.value.chorusTimestamp,
          cueDescription: singAlongResult.value.cueDescription,
          setupLyricExcerpt: singAlongResult.value.setupLyricExcerpt,
          answerLyricExcerpt: singAlongResult.value.answerLyricExcerpt,
          answerLyricStartTimeSeconds: singAlongResult.value.answerLyricStartTimeSeconds,
          clipStartTimeSeconds: singAlongResult.value.clipStartTimeSeconds,
          clipEndTimeSeconds: singAlongResult.value.clipEndTimeSeconds,
          choices: singAlongResult.value.choices,
          correctChoiceId: singAlongResult.value.correctChoiceId,
          validationStatus: singAlongResult.value.validation.valid ? "valid" : "invalid",
          uniqueContentKey: singAlongResult.value.uniqueContentKey,
          musicUsedContentKey: singAlongResult.value.musicUsedContentKey,
          duplicateCheck: singAlongResult.value.duplicateCheck,
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
          generationMode: "structured-candidate-inventory",
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

  const [meetMeHalfwayResult, landmarkDropResult] = await Promise.allSettled([
    resolveMeetMeHalfwayForDate(date),
    resolveLandmarkDropForDate(date)
  ]);
  const meetMeHalfway = meetMeHalfwayResult.status === "fulfilled"
    ? { status: "ready" as const, puzzle: meetMeHalfwayResult.value }
    : { status: "error" as const, error: meetMeHalfwayResult.reason instanceof Error ? meetMeHalfwayResult.reason.message : "Meet Me Halfway failed." };
  const landmarkDrop = landmarkDropResult.status === "fulfilled"
    ? { status: "ready" as const, puzzle: landmarkDropResult.value, imageStatus: "Verified photograph candidate" }
    : { status: "error" as const, error: landmarkDropResult.reason instanceof Error ? landmarkDropResult.reason.message : "On a Postcard failed." };

  const dailySeed = getGameSeedForDate(date, "minefield");
  const puzzleHashes: Partial<Record<SeededGameId, string>> = {
    needledrop: needledrop.status === "ready" ? hashString(`${needledrop.puzzle.title}:${needledrop.puzzle.artist}:${needledrop.puzzle.chartDate}`).toString(16) : undefined,
    "sing-along": singAlong.status === "ready" ? singAlong.puzzle.contentHash : undefined,
    "ranked-top-5": topTen.status === "ready" ? topTen.puzzle.contentHash : undefined,
    spelldrop: spellDrop.status === "ready" ? spellDrop.contentHash : undefined,
    closer: closer.status === "ready" ? closer.contentHash : undefined,
    "meet-me-halfway": meetMeHalfway.status === "ready" ? meetMeHalfway.puzzle.contentHash : undefined,
    "landmark-drop": landmarkDrop.status === "ready" ? landmarkDrop.puzzle.contentHash : undefined,
    minefield: resolveMinefieldPuzzle(date, 560, 700).uniqueContentKey
  };
  const duplicateChecks: Partial<Record<SeededGameId, { passed: boolean; duplicateDetected: boolean; retryCount?: number; warning?: string }>> = {
    needledrop: needledrop.status === "ready" ? needledrop.puzzle.duplicateCheck : undefined,
    "sing-along": singAlong.status === "ready" ? singAlong.puzzle.duplicateCheck : undefined,
    "ranked-top-5": topTen.status === "ready" ? topTen.puzzle.duplicateCheck : undefined,
    spelldrop: spellDrop.status === "ready" ? spellDrop.puzzle.duplicateCheck : undefined,
    closer: closer.status === "ready" ? closer.puzzle.duplicateCheck : undefined,
    "meet-me-halfway": meetMeHalfway.status === "ready" ? meetMeHalfway.puzzle.duplicateCheck : undefined,
    "landmark-drop": landmarkDrop.status === "ready" ? landmarkDrop.puzzle.duplicateCheck : undefined,
    minefield: resolveMinefieldPuzzle(date, 560, 700).duplicateCheck
  };
  const inventoryOverview = await getInventoryOverview().catch(() => []);
  const overviewByGame = new Map(inventoryOverview.map((item) => [item.gameId, item]));
  const routeReady = {
    needledrop: needledrop.status === "ready",
    "sing-along": singAlong.status === "ready",
    "ranked-top-5": topTen.status === "ready",
    spelldrop: spellDrop.status === "ready",
    closer: closer.status === "ready",
    "meet-me-halfway": meetMeHalfway.status === "ready",
    "landmark-drop": landmarkDrop.status === "ready",
    minefield: true
  } satisfies Record<SeededGameId, boolean>;
  const summaryStatuses = Object.fromEntries(Object.entries(routeReady).map(([gameId, ready]) => {
    if (!ready) return [gameId, "Failed"];
    const overview = gameId === "minefield" ? undefined : overviewByGame.get(gameId as Exclude<SeededGameId, "minefield">);
    if (overview?.healthStatus === "Low inventory" || overview?.healthStatus === "Critically low") return [gameId, "Low inventory warning"];
    return [gameId, "Generated"];
  })) as Partial<Record<SeededGameId, "Ready" | "Cached" | "Generated" | "Failed" | "Low inventory warning">>;
  const universeByGame: Partial<Record<SeededGameId, Record<string, unknown>>> = {
    needledrop: needledrop.status === "ready" ? {
      totalCandidates: needledrop.diagnostics.sourceUniverseSize,
      selectedCandidateId: needledrop.diagnostics.finalSelectedSong,
      excludedPreviouslyUsed: needledrop.diagnostics.duplicateRejectionCount,
      excludedSoftCooldown: needledrop.diagnostics.cooldownRejectionCount,
      excludedInvalid: needledrop.diagnostics.metadataRejectionCount + needledrop.diagnostics.previewAvailabilityRejectionCount,
      apiCalls: needledrop.diagnostics.providerApiCalls,
      dynamoDbReadCount: needledrop.puzzle.duplicateCheck?.checkedAgainstCount ?? 0,
      generationDurationMs: 0
    } : undefined,
    "sing-along": singAlong.status === "ready" ? singAlong.puzzle.contentUniverse : undefined,
    "ranked-top-5": topTen.status === "ready" ? topTen.puzzle.contentUniverse as unknown as Record<string, unknown> : undefined,
    spelldrop: spellDrop.status === "ready" ? spellDrop.contentUniverse : undefined,
    closer: closer.status === "ready" ? closer.contentUniverse : undefined,
    "meet-me-halfway": meetMeHalfway.status === "ready" ? meetMeHalfway.puzzle.contentUniverse as unknown as Record<string, unknown> : undefined,
    "landmark-drop": landmarkDrop.status === "ready" ? landmarkDrop.puzzle.contentUniverse as unknown as Record<string, unknown> : undefined
  };
  const failureByGame: Partial<Record<SeededGameId, string>> = {
    needledrop: needledrop.status === "error" ? needledrop.error : undefined,
    "sing-along": singAlong.status === "error" ? singAlong.error : undefined,
    "ranked-top-5": topTen.status === "error" ? topTen.error : undefined,
    spelldrop: spellDrop.status === "error" ? spellDrop.error : undefined,
    closer: closer.status === "error" ? closer.error : undefined,
    "meet-me-halfway": meetMeHalfway.status === "error" ? meetMeHalfway.error : undefined,
    "landmark-drop": landmarkDrop.status === "error" ? landmarkDrop.error : undefined
  };
  const contentHealth = inventoryOverview.map((overview) => {
    const diagnostics = universeByGame[overview.gameId] ?? {};
    const failed = !routeReady[overview.gameId];
    const failure = failureByGame[overview.gameId] ?? "";
    const failureStatus = /exhaust/i.test(failure) ? "Exhausted" : /provider|preview|chart|iTunes/i.test(failure) ? "Provider unavailable" : /DynamoDB|table|transaction|credential/i.test(failure) ? "Infrastructure failure" : "Validation failure";
    return {
      ...overview,
      totalCandidateInventory: Number(diagnostics.totalCandidates ?? overview.totalCandidateInventory),
      invalidCandidates: Number(diagnostics.excludedInvalid ?? overview.invalidCandidates),
      candidatesOnCooldown: Number(diagnostics.excludedSoftCooldown ?? 0),
      candidatesGeneratedCurrentRequest: Number(diagnostics.candidatesGeneratedCurrentRequest ?? 0),
      candidatesRejectedCurrentRequest: Number(diagnostics.excludedInvalid ?? 0) + Number(diagnostics.excludedPreviouslyUsed ?? 0),
      selectedCandidate: String(diagnostics.selectedCandidateId ?? ""),
      generationDurationMs: Number(diagnostics.generationDurationMs ?? 0),
      apiCalls: Number(diagnostics.apiCalls ?? 0),
      dynamoDbReads: Number(diagnostics.dynamoDbReadCount ?? overview.dynamoDbReads),
      dynamoDbWrites: Number(diagnostics.dynamoDbWrites ?? 0),
      finalStatus: failed ? failureStatus : overview.healthStatus,
      actionableFailureReason: failed ? failure : ""
    };
  });
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
    "sing-along": "reviewed timing inventory + staged iTunes discovery",
    "ranked-top-5": "structured-data candidate inventory",
    spelldrop: "WordNet/SUBTLEX/CMUdict candidate inventory",
    closer: "verified structured numeric inventory",
    "meet-me-halfway": "enumerated-world-city-pairs + DynamoDB duplicate filtering",
    "landmark-drop": "verified-landmark-photograph catalog + DynamoDB duplicate filtering",
    minefield: "deterministic-seeded-board"
  }, duplicateChecks, summaryStatuses);
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
    contentHealth,
    games: {
      needledrop,
      singAlong,
      minefield: { status: "ready", puzzle: resolveMinefieldPuzzle(date, 560, 700) },
      topTen,
      spellDrop,
      closer,
      meetMeHalfway,
      landmarkDrop
    }
  }, { headers: { "Cache-Control": "no-store" } });
}
