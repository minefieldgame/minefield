import { searchTrackPreview, searchTrackPreviewDiagnostic } from "@/lib/audioProvider";
import { getTopTenForDate } from "@/lib/chartProvider";
import { hashString, seededShuffle } from "@/lib/dailySeed";
import { puzzleNumber } from "@/lib/date";
import type { DailyPuzzle } from "@/types/game";

export async function resolveNeedleDropPuzzle(puzzleDate: string): Promise<DailyPuzzle> {
  const [currentYear, month, day] = puzzleDate.split("-").map(Number);
  const years = Array.from(
    { length: Math.max(0, currentYear - 1958) },
    (_, index) => 1958 + index
  );
  const seed = hashString(`needledrop:${puzzleDate}`);

  for (const year of seededShuffle(years, seed).slice(0, 24)) {
    const chart = await getTopTenForDate(month, day, year);
    for (const song of seededShuffle(chart.songs, hashString(`${seed}:${year}`))) {
      const track = await searchTrackPreview(song.title, song.artist);
      if (!track) continue;
      return {
        id: puzzleDate,
        number: puzzleNumber(puzzleDate),
        puzzleDate,
        chartDate: chart.date,
        chartSourceDate: chart.sourceDate,
        chartYear: year,
        chartPosition: song.position,
        title: song.title,
        artist: song.artist,
        track
      };
    }
  }
  throw new Error("No playable track found");
}

export async function resolveNeedleDropDiagnostic(puzzleDate: string) {
  const startedAt = new Date().toISOString();
  const puzzle = await resolveNeedleDropPuzzle(puzzleDate);
  const [, month, day] = puzzleDate.split("-").map(Number);
  const chart = await getTopTenForDate(month, day, puzzle.chartYear);
  const audio = await searchTrackPreviewDiagnostic(puzzle.title, puzzle.artist);
  return {
    puzzle,
    diagnostics: {
      requestStatus: "completed",
      responseStatus: 200,
      matchConfidence: audio.confidence,
      previewAvailable: Boolean(audio.track?.previewUrl),
      sourceProvider: "Billboard archive + iTunes Search API",
      generatedAt: startedAt,
      errors: [] as string[]
    },
    rawProviderResponse: {
      chart,
      iTunes: audio.rawResponse,
      rankedMatches: audio.rankedResults
    }
  };
}
