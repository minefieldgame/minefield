import { NextRequest, NextResponse } from "next/server";
import { getPacificDateKey } from "@/lib/date";
import { resolveRankedTop5ForDate } from "@/lib/content/dailyPuzzleResolvers";
import {
  createDynamicApiError,
  dynamicResolverDiagnostics
} from "@/lib/content/dynamicErrors";

export const dynamic = "force-dynamic";
const ROUTE = "/api/top-ten/generate";

export async function GET(request: NextRequest) {
  const selected = request.nextUrl.searchParams.get("date");
  const datedRequest = Boolean(selected && /^\d{4}-\d{2}-\d{2}$/.test(selected));
  const date = datedRequest ? selected! : getPacificDateKey();
  const retryOffset = Number(request.nextUrl.searchParams.get("retry") ?? 0);
  try {
    const puzzle = await resolveRankedTop5ForDate(date, {
      force: retryOffset > 0,
      retryOffset: Number.isFinite(retryOffset) ? retryOffset : 0
    });
    return NextResponse.json({
      ...puzzle,
      resolverDiagnostics: dynamicResolverDiagnostics("ranked-top-5", date, ROUTE)
    }, {
      headers: { "Cache-Control": retryOffset > 0 || !datedRequest ? "no-store" : "public, s-maxage=31536000, immutable" }
    });
  } catch (error) {
    console.error("[Ranked Top 5 API failure]", {
      date,
      retryOffset,
      error: error instanceof Error ? error.message : "Unknown generation error"
    });
    return NextResponse.json(
      createDynamicApiError({ gameId: "ranked-top-5", date, route: ROUTE, reason: error }),
      { status: 502 }
    );
  }
}
