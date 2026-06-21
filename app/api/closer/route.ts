import { NextRequest, NextResponse } from "next/server";
import { resolveCloserForDate } from "@/lib/content/dailyPuzzleResolvers";
import { getPacificDateKey } from "@/lib/date";
import {
  createDynamicApiError,
  dynamicResolverDiagnostics
} from "@/lib/content/dynamicErrors";

export const dynamic = "force-dynamic";
const ROUTE = "/api/closer";

export async function GET(request: NextRequest) {
  const selected = request.nextUrl.searchParams.get("date");
  const datedRequest = Boolean(selected && /^\d{4}-\d{2}-\d{2}$/.test(selected));
  const date = datedRequest ? selected! : getPacificDateKey();
  try {
    const result = await resolveCloserForDate(date);
    return NextResponse.json({
      ...result,
      ...result.puzzle,
      puzzle: result.puzzle,
      resolverDiagnostics: dynamicResolverDiagnostics("closer", date, ROUTE)
    }, {
      headers: { "Cache-Control": datedRequest ? "public, s-maxage=31536000, immutable" : "no-store" }
    });
  } catch (error) {
    console.error("[Closer unavailable]", { date, error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      createDynamicApiError({ gameId: "closer", date, route: ROUTE, reason: error }),
      { status: 503 }
    );
  }
}
