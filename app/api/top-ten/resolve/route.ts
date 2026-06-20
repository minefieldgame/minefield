import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  await request.json().catch(() => null);
  return NextResponse.json(
    { error: "Category resolution is now handled by the shared daily content engine." },
    { status: 410 }
  );
}
