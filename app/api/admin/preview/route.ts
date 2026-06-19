import { NextRequest, NextResponse } from "next/server";
import {
  getTopTenProviderStatus,
  resolveDailyTopTenPuzzle,
  validateTopTenPuzzle
} from "@/games/top-ten/providers";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_VALUE
} from "@/lib/adminAuth";
import { hashString } from "@/lib/dailySeed";
import { getDailyGameDate } from "@/lib/date";
import { resolveNeedleDropDiagnostic } from "@/lib/needledropResolver";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (request.cookies.get(ADMIN_COOKIE_NAME)?.value !== ADMIN_SESSION_VALUE) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const selected = request.nextUrl.searchParams.get("date");
  const date = selected && /^\d{4}-\d{2}-\d{2}$/.test(selected)
    ? selected
    : getDailyGameDate();
  const generatedAt = new Date().toISOString();
  const dailySeed = hashString(`minefield:${date}`);
  const topTenRetry = Number(request.nextUrl.searchParams.get("topTenRetry") ?? 0);

  const [needledropResult, topTenResult] = await Promise.allSettled([
    resolveNeedleDropDiagnostic(date),
    resolveDailyTopTenPuzzle(date, {
      force: topTenRetry > 0,
      retryOffset: Number.isFinite(topTenRetry) ? topTenRetry : 0
    })
  ]);

  const needledrop =
    needledropResult.status === "fulfilled"
      ? { status: "ready", ...needledropResult.value }
      : {
          status: "error",
          error: needledropResult.reason instanceof Error
            ? needledropResult.reason.message
            : "NeedleDrop generation failed."
        };

  const topTen =
    topTenResult.status === "fulfilled"
      ? {
          status: "ready",
          puzzle: topTenResult.value,
          diagnostics: {
            sourceProvider:
              topTenResult.value.generationMode === "live-ai"
                ? "OpenAI Responses API + web search"
                : "Deterministic development mock",
            validationStatus: validateTopTenPuzzle(topTenResult.value).valid ? "valid" : "invalid",
            dataFreshness:
              topTenResult.value.generationMode === "live-ai"
                ? `Generated ${topTenResult.value.generatedAt}`
                : "Static development fixture",
            confidence: topTenResult.value.confidence,
            generationMode: topTenResult.value.generationMode,
            apiKeyConfigured: getTopTenProviderStatus().apiKeyConfigured,
            warning: topTenResult.value.warning ?? getTopTenProviderStatus().warning,
            errors: topTenResult.value.validation.errors
          },
          rawProviderResponse: topTenResult.value.rawAIResponse ?? {
            sourceUrl: topTenResult.value.sourceUrl,
            rankedAnswers: topTenResult.value.answers
          }
        }
      : {
          status: "error",
          error: topTenResult.reason instanceof Error
            ? topTenResult.reason.message
            : "Top 10 generation failed."
        };

  return NextResponse.json(
    {
      date,
      pacificDate: date,
      dailySeed,
      seedHash: dailySeed.toString(16).padStart(8, "0"),
      generatedAt,
      games: { needledrop, topTen }
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
