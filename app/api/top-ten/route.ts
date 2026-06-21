import { NextRequest, NextResponse } from "next/server";
import { getPacificDateKey } from "@/lib/date";
import { resolveDailyTopTenPuzzle } from "@/games/top-ten/providers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestedDate = request.nextUrl.searchParams.get("date");
  const datedRequest = Boolean(requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate));
  const date = datedRequest ? requestedDate! : getPacificDateKey();
  try {
    const puzzle = await resolveDailyTopTenPuzzle(date);
    return NextResponse.json(puzzle, {
      headers: { "Cache-Control": datedRequest ? "public, s-maxage=31536000, immutable" : "no-store" }
    });
  } catch {
    return NextResponse.json(
      { error: "Today’s Top 10 could not be generated. Please try again later." },
      { status: 502 }
    );
  }
}
