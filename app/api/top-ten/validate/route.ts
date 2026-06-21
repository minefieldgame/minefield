import { NextRequest, NextResponse } from "next/server";
import { validateTopTenPuzzle } from "@/games/top-ten/providers";
import type { RankedTopTenPuzzle } from "@/games/top-ten/types";

export async function POST(request: NextRequest) {
  const puzzle = (await request.json().catch(() => null)) as RankedTopTenPuzzle | null;
  if (!puzzle) {
    return NextResponse.json({ error: "Puzzle JSON is required." }, { status: 400 });
  }
  return NextResponse.json(validateTopTenPuzzle(puzzle));
}
