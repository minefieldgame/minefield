import { NextRequest, NextResponse } from "next/server";
import { getTopTenProviderStatus, validateTopTenPuzzle } from "@/games/top-ten/providers";
import {
  resolveCloserForDate,
  resolveNeedleDropForDate,
  resolveRankedTop5ForDate,
  resolveSpellDropForDate
} from "@/lib/content/dailyPuzzleResolvers";
import { resolveOddOneOutForDate } from "@/lib/content/oddOneOutResolver";
import { resolveVaultbreakForDate } from "@/lib/content/vaultbreakResolver";
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
import { ACTIVE_GAME_IDS } from "@/lib/gameDisplay";
import { buildInventoryMetrics } from "@/lib/content/inventoryMetrics";
import { buildAdminStatusSummary, classifySelectedDateStatus } from "@/lib/content/adminStatus";

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

  const [needledropResult, oddOneOutResult, vaultbreakResult, topTenResult, spellDropResult, closerResult] = await Promise.allSettled([
    resolveNeedleDropForDate(date),
    resolveOddOneOutForDate(date),
    resolveVaultbreakForDate(date),
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

  const oddOneOut = oddOneOutResult.status === "fulfilled"
    ? {
        status: "ready" as const,
        puzzle: oddOneOutResult.value,
        diagnostics: oddOneOutResult.value.diagnostics ?? {
          selectedDate: date,
          cacheKey: getGameCacheKey("odd-one-out", date),
          status: oddOneOutResult.value.cacheHit ? "Cached" as const : "Generated" as const,
          contentHash: oddOneOutResult.value.contentHash ?? hashString(oddOneOutResult.value.uniqueContentKey ?? oddOneOutResult.value.id).toString(16),
          categoryFamily: oddOneOutResult.value.category,
          difficulty: oddOneOutResult.value.difficulty,
          qualityScore: oddOneOutResult.value.qualityScore ?? 0,
          recognizabilityScore: oddOneOutResult.value.recognizabilityScore ?? 0,
          exactDuplicateStatus: "available" as const,
          cooldownStatus: "clear" as const,
          inventoryTotal: 0,
          eligibleInventory: 0,
          unusedEligibleInventory: 0,
          rejectedCandidates: 0,
          selectedCandidateId: oddOneOutResult.value.candidateId ?? oddOneOutResult.value.id,
          sourceGenerationStrategy: "project-authored-source-backed-template" as const,
          sourceStrategy: "project-authored-source-backed-template" as const,
          dynamoDbReads: 0,
          dynamoDbKeysRead: 0,
          dynamoDbWrites: 0,
          candidateCollisionRetries: 0,
          generationDurationMs: 0
        }
      }
    : {
        status: "error" as const,
        error: oddOneOutResult.reason instanceof Error ? oddOneOutResult.reason.message : "Odd One Out failed."
      };

  const vaultbreak = vaultbreakResult.status === "fulfilled"
    ? {
        status: "ready" as const,
        puzzle: vaultbreakResult.value,
        diagnostics: vaultbreakResult.value.resolverDiagnostics
      }
    : {
        status: "error" as const,
        error: vaultbreakResult.reason instanceof Error ? vaultbreakResult.reason.message : "Vaultbreak failed."
      };

  const singAlong = {
    status: "retired" as const,
    message: "Retired from the active daily board because synchronized commercial lyric timing cannot be scaled without the required licensing. Legacy data remains read-only."
  };

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

  const minefieldPuzzle = resolveMinefieldPuzzle(date, 640, 800);
  const dailySeed = getGameSeedForDate(date, "minefield");
  const puzzleHashes: Partial<Record<SeededGameId, string>> = {
    needledrop: needledrop.status === "ready" ? hashString(`${needledrop.puzzle.title}:${needledrop.puzzle.artist}:${needledrop.puzzle.chartDate}`).toString(16) : undefined,
    "odd-one-out": oddOneOut.status === "ready" ? oddOneOut.diagnostics.contentHash : undefined,
    vaultbreak: vaultbreak.status === "ready" ? vaultbreak.puzzle.contentHash : undefined,
    "ranked-top-5": topTen.status === "ready" ? topTen.puzzle.contentHash : undefined,
    spelldrop: spellDrop.status === "ready" ? spellDrop.contentHash : undefined,
    closer: closer.status === "ready" ? closer.contentHash : undefined,
    "meet-me-halfway": meetMeHalfway.status === "ready" ? meetMeHalfway.puzzle.contentHash : undefined,
    "landmark-drop": landmarkDrop.status === "ready" ? landmarkDrop.puzzle.contentHash : undefined,
    minefield: minefieldPuzzle.uniqueContentKey
  };
  const duplicateChecks: Partial<Record<SeededGameId, { passed: boolean; duplicateDetected: boolean; retryCount?: number; warning?: string }>> = {
    needledrop: needledrop.status === "ready" ? needledrop.puzzle.duplicateCheck : undefined,
    "odd-one-out": oddOneOut.status === "ready" ? oddOneOut.puzzle.duplicateCheck : undefined,
    vaultbreak: vaultbreak.status === "ready" ? vaultbreak.puzzle.duplicateCheck : undefined,
    "ranked-top-5": topTen.status === "ready" ? topTen.puzzle.duplicateCheck : undefined,
    spelldrop: spellDrop.status === "ready" ? spellDrop.puzzle.duplicateCheck : undefined,
    closer: closer.status === "ready" ? closer.puzzle.duplicateCheck : undefined,
    "meet-me-halfway": meetMeHalfway.status === "ready" ? meetMeHalfway.puzzle.duplicateCheck : undefined,
    "landmark-drop": landmarkDrop.status === "ready" ? landmarkDrop.puzzle.duplicateCheck : undefined,
    minefield: minefieldPuzzle.duplicateCheck
  };
  const inventoryOverview = await getInventoryOverview().catch(() => []);
  const overviewByGame = new Map(inventoryOverview.map((item) => [item.gameId, item]));
  const routeReady: Partial<Record<SeededGameId, boolean>> = {
    needledrop: needledrop.status === "ready",
    "odd-one-out": oddOneOut.status === "ready",
    vaultbreak: vaultbreak.status === "ready",
    "ranked-top-5": topTen.status === "ready",
    spelldrop: spellDrop.status === "ready",
    closer: closer.status === "ready",
    "meet-me-halfway": meetMeHalfway.status === "ready",
    "landmark-drop": landmarkDrop.status === "ready",
    minefield: true
  };
  const failureByGame: Partial<Record<SeededGameId, string>> = {
    needledrop: needledrop.status === "error" ? needledrop.error : undefined,
    "odd-one-out": oddOneOut.status === "error" ? oddOneOut.error : undefined,
    vaultbreak: vaultbreak.status === "error" ? vaultbreak.error : undefined,
    "ranked-top-5": topTen.status === "error" ? topTen.error : undefined,
    spelldrop: spellDrop.status === "error" ? spellDrop.error : undefined,
    closer: closer.status === "error" ? closer.error : undefined,
    "meet-me-halfway": meetMeHalfway.status === "error" ? meetMeHalfway.error : undefined,
    "landmark-drop": landmarkDrop.status === "error" ? landmarkDrop.error : undefined
  };
  const cacheHitByGame: Partial<Record<SeededGameId, boolean>> = {
    needledrop: needledrop.status === "ready" && Boolean((needledrop as typeof needledrop & { cacheHit?: boolean }).cacheHit),
    "odd-one-out": oddOneOut.status === "ready" && Boolean(oddOneOut.puzzle.cacheHit),
    vaultbreak: vaultbreak.status === "ready" && vaultbreak.puzzle.cacheHit,
    "ranked-top-5": topTen.status === "ready" && Boolean(topTen.puzzle.cacheHit),
    spelldrop: spellDrop.status === "ready" && Boolean(spellDrop.cacheHit),
    closer: closer.status === "ready" && Boolean(closer.cacheHit),
    "meet-me-halfway": meetMeHalfway.status === "ready" && Boolean((meetMeHalfway.puzzle as typeof meetMeHalfway.puzzle & { cacheHit?: boolean }).cacheHit),
    "landmark-drop": landmarkDrop.status === "ready" && Boolean((landmarkDrop.puzzle as typeof landmarkDrop.puzzle & { cacheHit?: boolean }).cacheHit),
    minefield: false
  };
  const summaryStatuses = Object.fromEntries(ACTIVE_GAME_IDS.map((gameId) => {
    const ready = routeReady[gameId] === true;
    if (!ready) return [gameId, "Failed"];
    const overview = gameId === "minefield" ? undefined : overviewByGame.get(gameId);
    if (overview?.healthStatus === "Low eligible inventory" || overview?.healthStatus === "Critically low eligible inventory") return [gameId, "Low inventory warning"];
    const selectedDateStatus = classifySelectedDateStatus({ ready, cacheHit: cacheHitByGame[gameId] });
    return [gameId, selectedDateStatus === "Cached" ? "Cached" : "Generated"];
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
    "odd-one-out": oddOneOut.status === "ready" ? {
      totalCandidates: oddOneOut.diagnostics.inventoryTotal,
      selectedCandidateId: oddOneOut.diagnostics.selectedCandidateId,
      excludedPreviouslyUsed: Math.max(0, oddOneOut.diagnostics.eligibleInventory - oddOneOut.diagnostics.unusedEligibleInventory),
      excludedSoftCooldown: oddOneOut.diagnostics.cooldownStatus === "relaxed" ? 1 : 0,
      excludedInvalid: oddOneOut.diagnostics.rejectedCandidates,
      apiCalls: 0,
      dynamoDbReadCount: oddOneOut.diagnostics.dynamoDbReads,
      dynamoDbWrites: oddOneOut.diagnostics.dynamoDbWrites,
      generationDurationMs: oddOneOut.diagnostics.generationDurationMs
    } : undefined,
    vaultbreak: vaultbreak.status === "ready" ? {
      totalCandidates: vaultbreak.diagnostics.initialCandidateCount,
      selectedCandidateId: vaultbreak.puzzle.id,
      candidatesGeneratedCurrentRequest: vaultbreak.diagnostics.generationAttempts,
      excludedPreviouslyUsed: vaultbreak.diagnostics.exactCollisionRetries,
      excludedSoftCooldown: vaultbreak.diagnostics.cooldownCollisions,
      excludedInvalid: Math.max(0, vaultbreak.diagnostics.generationAttempts - 1),
      apiCalls: 0,
      dynamoDbReadCount: vaultbreak.diagnostics.dynamoDbReads,
      dynamoDbWrites: vaultbreak.diagnostics.dynamoDbWrites,
      generationDurationMs: vaultbreak.diagnostics.generationDurationMs
    } : undefined,
    "ranked-top-5": topTen.status === "ready" ? topTen.puzzle.contentUniverse as unknown as Record<string, unknown> : undefined,
    spelldrop: spellDrop.status === "ready" ? spellDrop.contentUniverse : undefined,
    closer: closer.status === "ready" ? closer.contentUniverse : undefined,
    "meet-me-halfway": meetMeHalfway.status === "ready" ? meetMeHalfway.puzzle.contentUniverse as unknown as Record<string, unknown> : undefined,
    "landmark-drop": landmarkDrop.status === "ready" ? landmarkDrop.puzzle.contentUniverse as unknown as Record<string, unknown> : undefined
  };
  const contentHealth = inventoryOverview.filter((overview) => overview.gameId !== "sing-along").map((overview) => {
    const gameId = overview.gameId as SeededGameId;
    const diagnostics = universeByGame[gameId] ?? {};
    const ready = routeReady[gameId] === true;
    const failure = failureByGame[gameId] ?? "";
    const rewindInventory = gameId === "needledrop" && needledrop.status === "ready"
      ? needledrop.diagnostics.inventoryMetrics
      : null;
    const metrics = rewindInventory
      ? buildInventoryMetrics({
          discoveredUnique: rewindInventory.discoveredUniqueTracks,
          providerResponsesExamined: rewindInventory.providerResponsesExamined,
          technicallyValidUnique: rewindInventory.metadataValidUniqueTracks,
          qualityApproved: rewindInventory.qualityApprovedUniqueTracks,
          // Rewind quality approval is downstream of preview playability, so
          // the final playable set is the quality-approved intersection.
          playableEligible: rewindInventory.qualityApprovedUniqueTracks,
          previouslyUsed: rewindInventory.previouslyUsedUniqueTracks,
          unusedEligible: rewindInventory.unusedEligibleUniqueTracks,
          invalid: rewindInventory.rejectedProviderResponses,
          rejectedQuality: Math.max(0, rewindInventory.metadataValidUniqueTracks - rewindInventory.qualityApprovedUniqueTracks),
          duplicateAliasesCollapsed: rewindInventory.duplicateAliasesCollapsed
        })
      : overview.metrics;
    const status = buildAdminStatusSummary({
      inventoryHealthStatus: overview.healthStatus,
      ready,
      cacheHit: cacheHitByGame[gameId],
      error: failure
    });
    return {
      ...overview,
      metrics,
      totalCandidateInventory: metrics.discoveredUnique,
      validatedInventory: metrics.technicallyValidUnique,
      qualityApprovedInventory: metrics.qualityApproved,
      playableInventory: metrics.playableEligible,
      unusedInventory: metrics.unusedEligible,
      invalidCandidates: metrics.invalid,
      pendingReview: metrics.pendingExternalProviderData,
      rejectedQuality: metrics.rejectedQuality,
      exactDuplicatesUsed: metrics.previouslyUsed,
      candidatesOnCooldown: metrics.cooldown,
      candidatesGeneratedCurrentRequest: Number(diagnostics.candidatesGeneratedCurrentRequest ?? 0),
      candidatesRejectedCurrentRequest: Number(diagnostics.excludedInvalid ?? 0) + Number(diagnostics.excludedPreviouslyUsed ?? 0) + Number(diagnostics.excludedSoftCooldown ?? 0),
      selectedCandidate: String(diagnostics.selectedCandidateId ?? ""),
      generationDurationMs: Number(diagnostics.generationDurationMs ?? 0),
      apiCalls: Number(diagnostics.apiCalls ?? 0),
      dynamoDbReads: Number(diagnostics.dynamoDbReadCount ?? overview.dynamoDbReads),
      dynamoDbWrites: Number(diagnostics.dynamoDbWrites ?? 0),
      ...status
    };
  });
  const dailyBoard = buildDailyBoardSeedManifest(date, ACTIVE_GAME_IDS, puzzleHashes, {
    needledrop: "same-week Billboard history + iTunes original-preview validation",
    "odd-one-out": "project-authored source-backed validated template inventory",
    vaultbreak: "deterministic 5,040-code solver + atomic daily publication",
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
      oddOneOut: getGameCacheKey("odd-one-out", date),
      vaultbreak: getGameCacheKey("vaultbreak", date),
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
      oddOneOut,
      vaultbreak,
      singAlong,
      minefield: { status: "ready", puzzle: minefieldPuzzle },
      topTen,
      spellDrop,
      closer,
      meetMeHalfway,
      landmarkDrop
    }
  }, { headers: { "Cache-Control": "no-store" } });
}
