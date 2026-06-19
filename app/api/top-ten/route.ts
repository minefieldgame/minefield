import { NextRequest, NextResponse } from "next/server";
import { getDailyGameDate } from "@/lib/date";
import { resolveDailyTopTenPuzzle } from "@/games/top-ten/providers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestedDate = request.nextUrl.searchParams.get("date");
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : getDailyGameDate();
  try {
    const puzzle = await resolveDailyTopTenPuzzle(date);
    return NextResponse.json(puzzle, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" }
    });
  } catch {
    return NextResponse.json(
      { error: "Today’s Top 10 could not be generated. Please try again later." },
      { status: 502 }
    );
  }
}
