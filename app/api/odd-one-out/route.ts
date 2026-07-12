import { NextRequest, NextResponse } from "next/server";
import { getPacificDateKey } from "@/lib/date";
import { resolveOddOneOutForDate } from "@/lib/content/oddOneOutResolver";
import { puzzlePersistenceStatus } from "@/lib/content/persistence";

export const dynamic = "force-dynamic";
const ROUTE = "/api/odd-one-out";

export async function GET(request: NextRequest) {
  const selected = request.nextUrl.searchParams.get("date");
  const datedRequest = Boolean(selected && /^\d{4}-\d{2}-\d{2}$/.test(selected));
  const date = datedRequest ? selected! : getPacificDateKey();
  try {
    const puzzle = await resolveOddOneOutForDate(date);
    return NextResponse.json(puzzle, {
      headers: { "Cache-Control": datedRequest ? "public, s-maxage=31536000, immutable" : "no-store" }
    });
  } catch (error) {
    console.error("[Odd One Out unavailable]", { date, error: error instanceof Error ? error.message : error });
    return NextResponse.json({
      ok: false,
      gameId: "odd-one-out",
      date,
      errorType: error instanceof Error && error.name === "CandidatePoolExhaustedError"
        ? "candidate-pool-exhausted"
        : "resolver-failed",
      message: "Today's Odd One Out puzzle could not be loaded. Please try again shortly.",
      route: ROUTE,
      persistenceProvider: puzzlePersistenceStatus.provider
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
