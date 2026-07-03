import { NextRequest, NextResponse } from "next/server";
import { getPacificDateKey } from "@/lib/date";
import { resolveSingAlongForDate } from "@/lib/content/dailyPuzzleResolvers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestedDate = request.nextUrl.searchParams.get("date");
  const datedRequest = Boolean(requestedDate);
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : getPacificDateKey();

  try {
    const puzzle = await resolveSingAlongForDate(date);
    return NextResponse.json(puzzle, {
      headers: { "Cache-Control": datedRequest ? "public, s-maxage=31536000, immutable" : "no-store" }
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      gameId: "sing-along",
      date,
      errorType: "resolver_error",
      message: error instanceof Error ? error.message : "Today’s Sing Along puzzle could not be loaded.",
      route: "/api/sing-along",
      envDetected: Boolean(process.env.OPENAI_API_KEY),
      model: "deterministic-catalog+iTunes",
      cacheHit: false
    }, { status: 502 });
  }
}
