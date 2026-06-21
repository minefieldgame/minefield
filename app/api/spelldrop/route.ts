import { NextRequest, NextResponse } from "next/server";
import { resolveSpellDropForDate } from "@/games/spelldrop/providers";
import { getPacificDateKey } from "@/lib/date";
import {
  createDynamicApiError,
  dynamicResolverDiagnostics
} from "@/lib/content/dynamicErrors";

export const dynamic = "force-dynamic";
const ROUTE = "/api/spelldrop";

export async function GET(request: NextRequest) {
  const selected = request.nextUrl.searchParams.get("date");
  const datedRequest = Boolean(selected && /^\d{4}-\d{2}-\d{2}$/.test(selected));
  const date = datedRequest ? selected! : getPacificDateKey();
  try {
    const result = await resolveSpellDropForDate(date);
    return NextResponse.json({
      ...result,
      ...result.puzzle,
      puzzle: result.puzzle,
      resolverDiagnostics: dynamicResolverDiagnostics("spelldrop", date, ROUTE)
    }, {
      headers: { "Cache-Control": datedRequest ? "public, s-maxage=31536000, immutable" : "no-store" }
    });
  } catch (error) {
    console.error("[SpellDrop unavailable]", { date, error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      createDynamicApiError({ gameId: "spelldrop", date, route: ROUTE, reason: error }),
      { status: 503 }
    );
  }
}
