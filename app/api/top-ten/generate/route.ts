import { NextRequest, NextResponse } from "next/server";
import { getDailyGameDate } from "@/lib/date";
import { resolveDailyTopTenPuzzle } from "@/games/top-ten/providers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const selected = request.nextUrl.searchParams.get("date");
  const date = selected && /^\d{4}-\d{2}-\d{2}$/.test(selected)
    ? selected
    : getDailyGameDate();
  const retryOffset = Number(request.nextUrl.searchParams.get("retry") ?? 0);
  try {
    const puzzle = await resolveDailyTopTenPuzzle(date, {
      force: retryOffset > 0,
      retryOffset: Number.isFinite(retryOffset) ? retryOffset : 0
    });
    return NextResponse.json(puzzle, {
      headers: { "Cache-Control": retryOffset > 0 ? "no-store" : "public, s-maxage=86400" }
    });
  } catch (error) {
    console.error("[Top 10 API failure]", {
      date,
      retryOffset,
      error: error instanceof Error ? error.message : "Unknown generation error"
    });
    return NextResponse.json(
      {
        error: "Today’s Top 10 could not be generated. Please try again later.",
        diagnostic: error instanceof Error ? error.message : "Unknown generation error"
      },
      { status: 502 }
    );
  }
}
