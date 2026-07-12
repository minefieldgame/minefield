import { cleanArtistName, cleanSongTitle, similarity } from "@/lib/normalize";
import type { SongSuggestion, TrackPreview } from "@/types/game";

export type ITunesResult = {
  wrapperType?: string;
  artistId?: number;
  trackId?: number;
  collectionId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackViewUrl?: string;
};

const verifiedTrackPreviewCache = new Map<string, TrackPreview>();

function verifiedPreviewKey(songTitle: string, artistName: string) {
  return `${cleanSongTitle(songTitle)}::${cleanArtistName(artistName)}`.toLowerCase();
}

/** Only call this after a persisted provider result passes the full Sing Along eligibility gate. */
export function registerVerifiedTrackPreview(songTitle: string, artistName: string, track: TrackPreview) {
  verifiedTrackPreviewCache.set(verifiedPreviewKey(songTitle, artistName), track);
}

async function searchITunes(params: URLSearchParams) {
  const response = await fetch(`https://itunes.apple.com/search?${params}`, {
    next: { revalidate: 86400 }
  });
  if (!response.ok) throw new Error("iTunes search failed");
  return (await response.json()) as { results?: ITunesResult[] };
}

export async function discoverITunesTracks(queries: string[], perQuery = 50) {
  const settled = await Promise.allSettled(queries.map((term) => searchITunes(new URLSearchParams({
    term,
    media: "music",
    entity: "song",
    limit: String(Math.min(200, Math.max(1, perQuery))),
    country: "US",
    explicit: "No"
  }))));
  const seen = new Set<string>();
  const tracks = settled.flatMap((result) => result.status === "fulfilled" ? result.value.results ?? [] : [])
    .filter((result) => result.trackName && result.artistName && result.previewUrl)
    .filter((result) => {
      const key = `${cleanSongTitle(result.trackName!)}::${cleanArtistName(result.artistName!)}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return {
    tracks,
    apiCalls: queries.length,
    errors: settled.flatMap((result) => result.status === "rejected" ? [result.reason instanceof Error ? result.reason.message : "iTunes discovery failed"] : [])
  };
}

async function lookupITunes(params: URLSearchParams) {
  const response = await fetch(`https://itunes.apple.com/lookup?${params}`, {
    next: { revalidate: 86400 }
  });
  if (!response.ok) throw new Error("iTunes lookup failed");
  return (await response.json()) as { results?: ITunesResult[] };
}

export function getBestITunesMatch(
  results: ITunesResult[],
  songTitle: string,
  artistName: string
): TrackPreview | null {
  const ranked = results
    .filter((result) => result.previewUrl && result.trackName && result.artistName)
    .map((result) => ({
      result,
      score:
        similarity(result.trackName!, songTitle) * 0.65 +
        similarity(result.artistName!, artistName) * 0.35 +
        (result.trackViewUrl ? 0.05 : 0)
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < 0.55) return null;
  const item = best.result;
  return {
    trackName: item.trackName!,
    artistName: item.artistName!,
    collectionName: item.collectionName ?? "",
    artworkUrl: (item.artworkUrl100 ?? "").replace("100x100", "600x600"),
    previewUrl: item.previewUrl!,
    trackViewUrl: item.trackViewUrl ?? "",
    trackId: item.trackId,
    collectionId: item.collectionId,
    recordingIdentity: item.trackId ? `itunes:${item.trackId}` : undefined,
    matchConfidence: Math.min(1, best.score),
    sourceProvider: "iTunes Search API"
  };
}

export function getBestITunesMatchDiagnostic(
  results: ITunesResult[],
  songTitle: string,
  artistName: string
) {
  const ranked = results
    .filter((result) => result.trackName && result.artistName)
    .map((result) => ({
      result,
      score:
        similarity(result.trackName!, songTitle) * 0.65 +
        similarity(result.artistName!, artistName) * 0.35 +
        (result.trackViewUrl ? 0.05 : 0)
    }))
    .sort((a, b) => b.score - a.score);
  const best = ranked.find((entry) => entry.result.previewUrl);
  return {
    track: getBestITunesMatch(results, songTitle, artistName),
    confidence: best ? Math.min(1, best.score) : 0,
    rankedResults: ranked.slice(0, 10)
  };
}

export async function searchTrackPreview(songTitle: string, artistName: string) {
  const verified = verifiedTrackPreviewCache.get(verifiedPreviewKey(songTitle, artistName));
  if (verified) return verified;
  const params = new URLSearchParams({
    term: `${songTitle} ${artistName}`,
    media: "music",
    entity: "song",
    limit: "15",
    country: "US"
  });
  const payload = await searchITunes(params);
  return getBestITunesMatch(payload.results ?? [], songTitle, artistName);
}

export async function searchTrackPreviewDiagnostic(songTitle: string, artistName: string) {
  const params = new URLSearchParams({
    term: `${songTitle} ${artistName}`,
    media: "music",
    entity: "song",
    limit: "15",
    country: "US"
  });
  const payload = await searchITunes(params);
  return {
    ...getBestITunesMatchDiagnostic(payload.results ?? [], songTitle, artistName),
    rawResponse: payload
  };
}

export async function searchSongSuggestions(query: string): Promise<SongSuggestion[]> {
  const songParams = new URLSearchParams({
    term: query,
    media: "music",
    entity: "song",
    limit: "25",
    country: "US"
  });
  const artistParams = new URLSearchParams({
    term: query,
    media: "music",
    entity: "musicArtist",
    limit: "5",
    country: "US"
  });
  const [songPayload, artistPayload] = await Promise.all([
    searchITunes(songParams),
    searchITunes(artistParams).catch(() => ({ results: [] }))
  ]);
  const artistSongs = await Promise.all(
    (artistPayload.results ?? [])
      .filter((result) => result.artistId)
      .slice(0, 2)
      .map((result) =>
        lookupITunes(new URLSearchParams({
          id: String(result.artistId),
          entity: "song",
          limit: "20",
          sort: "recent",
          country: "US"
        })).catch(() => ({ results: [] }))
      )
  );
  const normalizedQuery = query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const seen = new Set<string>();
  return [
    ...(songPayload.results ?? []),
    ...artistSongs.flatMap((payload) => payload.results ?? [])
  ]
    .filter((result) => result.trackName && result.artistName)
    .map((result) => {
      const title = cleanSongTitle(result.trackName!);
      const artist = cleanArtistName(result.artistName!);
      const normalizedTitle = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      const normalizedArtist = artist.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      const score =
        (normalizedTitle === normalizedQuery ? 5 : 0) +
        (normalizedArtist === normalizedQuery ? 4.5 : 0) +
        (normalizedTitle.includes(normalizedQuery) ? 2.5 : 0) +
        (normalizedArtist.includes(normalizedQuery) ? 2.25 : 0) +
        similarity(`${title} ${artist}`, query);
      return { result, title, artist, normalizedTitle, normalizedArtist, score };
    })
    .sort((left, right) => right.score - left.score)
    .flatMap(({ result, title, artist, normalizedTitle, normalizedArtist }) => {
      const key = `${normalizedTitle}::${normalizedArtist}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{
        id: result.trackId ?? key,
        title,
        artist,
        rawTitle: result.trackName!
      }];
    })
    .slice(0, 10);
}
