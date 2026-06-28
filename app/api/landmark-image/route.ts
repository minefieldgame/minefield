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

const REJECT_TITLE = /\b(painting|illustration|drawing|sketch|logo|map|plan|diagram|icon|svg|coat of arms|poster|stamp|coin|banknote|ai generated|generated)\b/i;
const PHOTO_HINT = /\b(photo|photograph|view|tower|bridge|statue|cathedral|mosque|temple|castle|palace|gate|arch|mountain|opera|wall|pyramid|redentor|cristo|colosseum|parthenon|taj|mahal|borobudur|angkor|pagoda|shrine|needle|rushmore|uluru)\b/i;

function usablePhoto(page: CommonsPage) {
  const title = page.title ?? "";
  const info = page.imageinfo?.find((item) => item.mime?.startsWith("image/") && (item.thumburl || item.url));
  if (!info) return null;
  if (info.mime === "image/svg+xml") return null;
  if (REJECT_TITLE.test(title)) return null;
  return { info, score: PHOTO_HINT.test(title) ? 2 : 1 };
}

async function lookupSpecificFile(name: string, file: string) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    titles: `File:${file}`,
    prop: "imageinfo",
    iiprop: "url|mime",
    iiurlwidth: "900"
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "MinefieldDaily/1.0 (https://minefieldgame.com)"
    },
    next: { revalidate: 60 * 60 * 24 * 365 }
  });
  if (!response.ok) throw new Error(`Wikimedia file lookup returned ${response.status}`);
  const payload = await response.json() as { query?: { pages?: CommonsPage[] } };
  const page = payload.query?.pages?.[0];
  const candidate = page ? usablePhoto(page) : null;
  if (!candidate) throw new Error(`Pinned image for ${name} was not a usable photo: ${file}`);
  return candidate.info.thumburl ?? candidate.info.url!;
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name")?.trim();
  const file = request.nextUrl.searchParams.get("file")?.trim();
  if (!name || name.length > 100) {
    return NextResponse.json({ error: "A valid landmark name is required." }, { status: 400 });
  }

  try {
    const imageUrl = file ? await lookupSpecificFile(name, file) : null;
    if (imageUrl) {
      return NextResponse.redirect(imageUrl, {
        status: 307,
        headers: { "Cache-Control": "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800" }
      });
    }
  } catch (error) {
    console.warn("[Landmark image pinned-file fallback]", {
      name,
      file,
      message: error instanceof Error ? error.message : "Unknown pinned file failure"
    });
  }

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: `${name} photograph -painting -illustration -map -logo`,
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
      .map(usablePhoto)
      .filter(Boolean)
      .sort((left, right) => right!.score - left!.score)[0]?.info;

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
