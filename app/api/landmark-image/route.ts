import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CommonsPage = {
  title?: string;
  imageinfo?: Array<{
    mime?: string;
    thumburl?: string;
    url?: string;
  }>;
};

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name")?.trim();
  if (!name || name.length > 100) {
    return NextResponse.json({ error: "A valid landmark name is required." }, { status: 400 });
  }

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: `${name} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "8",
    prop: "imageinfo",
    iiprop: "url|mime",
    iiurlwidth: "900"
  });

  try {
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MinefieldDaily/1.0 (https://minefieldgame.com)"
      },
      next: { revalidate: 60 * 60 * 24 * 30 }
    });
    if (!response.ok) throw new Error(`Wikimedia returned ${response.status}`);

    const payload = await response.json() as { query?: { pages?: CommonsPage[] } };
    const pages = payload.query?.pages ?? [];
    const normalizedName = name.toLowerCase();
    const ranked = [...pages].sort((left, right) => {
      const leftTitle = left.title?.toLowerCase() ?? "";
      const rightTitle = right.title?.toLowerCase() ?? "";
      return Number(rightTitle.includes(normalizedName)) - Number(leftTitle.includes(normalizedName));
    });
    const image = ranked
      .flatMap((page) => page.imageinfo ?? [])
      .find((info) => info.mime?.startsWith("image/") && (info.thumburl || info.url));

    if (!image) {
      return NextResponse.json({ error: "No usable landmark image was found." }, { status: 404 });
    }

    return NextResponse.redirect(image.thumburl ?? image.url!, {
      status: 307,
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800" }
    });
  } catch (error) {
    console.error("[Landmark image resolver]", {
      name,
      message: error instanceof Error ? error.message : "Unknown image lookup failure"
    });
    return NextResponse.json({ error: "Landmark image unavailable." }, { status: 502 });
  }
}
