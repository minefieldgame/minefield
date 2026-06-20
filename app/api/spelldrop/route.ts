import { NextRequest, NextResponse } from "next/server";
import { resolveDailySpellDropPuzzle } from "@/games/spelldrop/providers";
import { getDailyGameDate } from "@/lib/date";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const selected = request.nextUrl.searchParams.get("date");
  const date = selected && /^\d{4}-\d{2}-\d{2}$/.test(selected) ? selected : getDailyGameDate();
  try {
    const result = await resolveDailySpellDropPuzzle(date);
    return NextResponse.json({
      ...result.puzzle,
      contentHash: result.contentHash,
      confidence: result.confidence,
      generatedAt: result.generatedAt
    }, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" }
    });
  } catch (error) {
    console.error("[SpellDrop unavailable]", { date, error: error instanceof Error ? error.message : error });
    return NextResponse.json({ error: "Today’s SpellDrop could not be generated." }, { status: 503 });
  }
}
