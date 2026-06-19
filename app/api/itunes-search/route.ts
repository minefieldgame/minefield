import { NextRequest, NextResponse } from "next/server";
import { searchSongSuggestions, searchTrackPreview } from "@/lib/audioProvider";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title") ?? "";
  const artist = request.nextUrl.searchParams.get("artist") ?? "";
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length >= 2) {
    try {
      return NextResponse.json(
        { suggestions: await searchSongSuggestions(query) },
        { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } }
      );
    } catch {
      return NextResponse.json({ suggestions: [] });
    }
  }
  if (!title || !artist) {
    return NextResponse.json({ error: "A query or title and artist are required." }, { status: 400 });
  }
  try {
    return NextResponse.json({ track: await searchTrackPreview(title, artist) });
  } catch {
    return NextResponse.json({ error: "Preview search failed." }, { status: 502 });
  }
}
