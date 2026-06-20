import { cleanArtistName, cleanSongTitle, similarity } from "@/lib/normalize";
import type { SongSuggestion, TrackPreview } from "@/types/game";

export type ITunesResult = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackViewUrl?: string;
};

async function searchITunes(params: URLSearchParams) {
  const response = await fetch(`https://itunes.apple.com/search?${params}`, {
    next: { revalidate: 86400 }
  });
  if (!response.ok) throw new Error("iTunes search failed");
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
    trackViewUrl: item.trackViewUrl ?? ""
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
  const params = new URLSearchParams({
    term: query,
    media: "music",
    entity: "song",
    limit: "8",
    country: "US"
  });
  const payload = await searchITunes(params);
  const seen = new Set<string>();
  return (payload.results ?? [])
    .filter((result) => result.trackName && result.artistName)
    .flatMap((result) => {
      const title = cleanSongTitle(result.trackName!);
      const artist = cleanArtistName(result.artistName!);
      const key = `${title.toLowerCase()}::${artist.toLowerCase()}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{
        id: result.trackId ?? key,
        title,
        artist,
        rawTitle: result.trackName!
      }];
    })
    .slice(0, 7);
}
