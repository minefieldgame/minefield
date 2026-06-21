import { NextRequest, NextResponse } from "next/server";
import { resolveDailySpellDropPuzzle } from "@/games/spelldrop/providers";
import { getPacificDateKey } from "@/lib/date";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const selected = request.nextUrl.searchParams.get("date");
  const datedRequest = Boolean(selected && /^\d{4}-\d{2}-\d{2}$/.test(selected));
  const date = datedRequest ? selected! : getPacificDateKey();
  try {
    const result = await resolveDailySpellDropPuzzle(date);
    return NextResponse.json({
      ...result,
      ...result.puzzle,
      puzzle: result.puzzle
    }, {
      headers: { "Cache-Control": datedRequest ? "public, s-maxage=31536000, immutable" : "no-store" }
    });
  } catch (error) {
    console.error("[SpellDrop unavailable]", { date, error: error instanceof Error ? error.message : error });
    return NextResponse.json({ error: "Today’s SpellDrop could not be generated." }, { status: 503 });
  }
}
