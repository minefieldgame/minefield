import { NextRequest, NextResponse } from "next/server";
import { getPacificToday } from "@/lib/date";
import { resolveNeedleDropPuzzle } from "@/lib/needledropResolver";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestedDate = request.nextUrl.searchParams.get("date");
  const pacificToday = getPacificToday();
  const today = pacificToday.dateKey;
  const puzzleDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : today;
  try {
    const puzzle = await resolveNeedleDropPuzzle(puzzleDate);
    if (process.env.NODE_ENV === "development") {
      console.info("[NeedleDrop daily puzzle]", {
        pacificDate: today,
        historicalYear: puzzle.chartYear,
        chartDate: puzzle.chartDate,
        sourceChartIssue: puzzle.chartSourceDate,
        chartPosition: puzzle.chartPosition
      });
    }
    return NextResponse.json(puzzle, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return NextResponse.json(
      { error: "Today’s song could not be loaded. Please try again later." },
      { status: 502 }
    );
  }
}
