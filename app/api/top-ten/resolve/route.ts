import { NextRequest, NextResponse } from "next/server";
import { resolveTopTenCategory } from "@/games/top-ten/providers";
import type { TopTenCategory } from "@/games/top-ten/types";

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as {
    date?: string;
    category?: TopTenCategory;
  } | null;
  if (!payload?.category || !payload.date) {
    return NextResponse.json({ error: "Date and category are required." }, { status: 400 });
  }
  try {
    return NextResponse.json(await resolveTopTenCategory(payload.category, payload.date));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Category resolution failed." },
      { status: 502 }
    );
  }
}
