import { NextRequest, NextResponse } from "next/server";
import { getTopTenForDate } from "@/lib/chartProvider";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const month = Number(params.get("month"));
  const day = Number(params.get("day"));
  const year = Number(params.get("year"));
  if (!month || !day || year < 1958) {
    return NextResponse.json({ error: "Valid month, day and year are required." }, { status: 400 });
  }
  try {
    return NextResponse.json(await getTopTenForDate(month, day, year));
  } catch {
    return NextResponse.json({ error: "Chart data could not be loaded." }, { status: 502 });
  }
}
