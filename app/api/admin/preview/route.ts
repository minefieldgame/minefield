import { NextRequest, NextResponse } from "next/server";
import { resolveDailyTopTenPuzzle, getTopTenProviderStatus, validateTopTenPuzzle } from "@/games/top-ten/providers";
import { resolveDailySpellDropPuzzle } from "@/games/spelldrop/providers";
import { resolveDailyCloserPuzzle } from "@/games/closer/providers";
import { resolveMinefieldPuzzle } from "@/games/minefield/logic";
import { resolveLandmarkDropPuzzle, resolveMeetMeHalfwayPuzzle } from "@/games/geography/puzzles";
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_VALUE } from "@/lib/adminAuth";
import { getAIStatus } from "@/lib/content/aiClient";
import { hashString } from "@/lib/dailySeed";
import { getDailyGameDate } from "@/lib/date";
import { resolveNeedleDropDiagnostic } from "@/lib/needledropResolver";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (request.cookies.get(ADMIN_COOKIE_NAME)?.value !== ADMIN_SESSION_VALUE) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const selected = request.nextUrl.searchParams.get("date");
  const date = selected && /^\d{4}-\d{2}-\d{2}$/.test(selected) ? selected : getDailyGameDate();
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

  const [needledropResult, topTenResult, spellDropResult, closerResult] = await Promise.allSettled([
    resolveNeedleDropDiagnostic(date),
    resolveDailyTopTenPuzzle(date, { force: topTenRetry > 0 || force, retryOffset: topTenRetry }),
    resolveDailySpellDropPuzzle(date, force),
    resolveDailyCloserPuzzle(date, force)
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
          generationMode: topTenResult.value.generationMode,
          apiKeyConfigured: providerStatus.apiKeyConfigured,
          warning: providerStatus.warning,
          errors: topTenResult.value.validation.errors
        },
        rawProviderResponse: topTenResult.value.rawAIResponse
      }
    : {
        status: "error" as const,
        error: topTenResult.reason instanceof Error ? topTenResult.reason.message : "Top 3 failed.",
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
    pacificDate: date,
    dailySeed,
    seedHash: dailySeed.toString(16).padStart(8, "0"),
    generatedAt: new Date().toISOString(),
    games: {
      needledrop,
      minefield: { status: "ready", puzzle: resolveMinefieldPuzzle(date) },
      topTen,
      spellDrop,
      closer,
      meetMeHalfway: { status: "ready", puzzle: resolveMeetMeHalfwayPuzzle(date) },
      landmarkDrop: { status: "ready", puzzle: resolveLandmarkDropPuzzle(date), imageStatus: "Loaded client-side with graceful fallback" }
    }
  }, { headers: { "Cache-Control": "no-store" } });
}
