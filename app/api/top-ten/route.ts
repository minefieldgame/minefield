import { NextRequest, NextResponse } from "next/server";
import { getPacificDateKey } from "@/lib/date";
import { resolveRankedTop5ForDate } from "@/lib/content/dailyPuzzleResolvers";
import {
  createDynamicApiError,
  dynamicResolverDiagnostics
} from "@/lib/content/dynamicErrors";

export const dynamic = "force-dynamic";
const ROUTE = "/api/top-ten";

export async function GET(request: NextRequest) {
  const requestedDate = request.nextUrl.searchParams.get("date");
  const datedRequest = Boolean(requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate));
  const date = datedRequest ? requestedDate! : getPacificDateKey();
  try {
    const puzzle = await resolveRankedTop5ForDate(date);
    return NextResponse.json({
      ...puzzle,
      resolverDiagnostics: dynamicResolverDiagnostics("ranked-top-5", date, ROUTE)
    }, {
      headers: { "Cache-Control": datedRequest ? "public, s-maxage=31536000, immutable" : "no-store" }
    });
  } catch (error) {
    return NextResponse.json(
      createDynamicApiError({ gameId: "ranked-top-5", date, route: ROUTE, reason: error }),
      { status: 502 }
    );
  }
}
