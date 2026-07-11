import { NextRequest, NextResponse } from "next/server";
import { getPacificDateKey } from "@/lib/date";
import { resolveMeetMeHalfwayForDate } from "@/games/geography/serverPuzzles";
import { puzzlePersistenceStatus } from "@/lib/content/persistence";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const selected = request.nextUrl.searchParams.get("date");
  const date = selected && /^\d{4}-\d{2}-\d{2}$/.test(selected) ? selected : getPacificDateKey();
  try {
    const puzzle = await resolveMeetMeHalfwayForDate(date);
    return NextResponse.json(puzzle, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      gameId: "meet-me-halfway",
      date,
      errorType: "resolver-failed",
      message: error instanceof Error ? error.message : "Today’s Meet Me Halfway puzzle could not be loaded.",
      route: "/api/meet-me-halfway",
      envDetected: Boolean(process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION),
      model: "enumerated-world-city-pairs",
      cacheHit: false,
      persistenceProvider: puzzlePersistenceStatus
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
