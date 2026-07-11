import { NextRequest, NextResponse } from "next/server";
import { resolveLandmarkDropForDate } from "@/games/geography/serverPuzzles";
import { puzzlePersistenceStatus } from "@/lib/content/persistence";
import { getPacificDateKey } from "@/lib/date";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const selected = request.nextUrl.searchParams.get("date");
  const date = selected && /^\d{4}-\d{2}-\d{2}$/.test(selected) ? selected : getPacificDateKey();
  try {
    const puzzle = await resolveLandmarkDropForDate(date);
    return NextResponse.json(puzzle, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      gameId: "landmark-drop",
      date,
      errorType: "resolver-failed",
      message: error instanceof Error ? error.message : "Today’s On a Postcard puzzle could not be loaded.",
      route: "/api/landmark-drop",
      envDetected: Boolean(process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION),
      model: "verified-landmark-photograph-catalog",
      cacheHit: false,
      persistenceProvider: puzzlePersistenceStatus
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
