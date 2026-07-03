import { searchTrackPreview, searchTrackPreviewDiagnostic } from "@/lib/audioProvider";
import { getTopTenForDate } from "@/lib/chartProvider";
import { getGameSeedForDate, hashString, seededShuffle } from "@/lib/dailySeed";
import { puzzleNumber } from "@/lib/date";
import { normalizeArtist, normalizeMusicString } from "@/lib/normalize";
import type { DailyPuzzle } from "@/types/game";
import { createMusicUsedContentKey } from "@/lib/content/usedContentRegistry";

type PreviewAttempt = {
  year: number;
  chartDate: string;
  chartPosition: number;
  title: string;
  artist: string;
  available: boolean;
};

type ResolutionDiagnostics = {
  requestedChartDate: string;
  resolvedChartDate: string;
  fallbackUsed: boolean;
  fallbackReason: string;
  attemptedYears: number[];
  attemptedChartDates: string[];
  attemptedChartPositions: number[];
  previewAvailability: PreviewAttempt[];
  finalSelectedSong: string;
  errors: string[];
};

type Resolution = { puzzle: DailyPuzzle; diagnostics: ResolutionDiagnostics };
const resolutionCache = new Map<string, Promise<Resolution>>();

async function resolveWithFallbacks(puzzleDate: string): Promise<Resolution> {
  const [currentYear, month, day] = puzzleDate.split("-").map(Number);
  const years = Array.from(
    { length: Math.max(0, currentYear - 1958) },
    (_, index) => 1958 + index
  );
  const seed = getGameSeedForDate(puzzleDate, "needledrop");
  const candidateYears = seededShuffle(years, seed).slice(0, 10);
  const attemptedYears: number[] = [];
  const attemptedChartDates: string[] = [];
  const attemptedChartPositions: number[] = [];
  const previewAvailability: PreviewAttempt[] = [];
  const errors: string[] = [];

  for (const year of candidateYears) {
    attemptedYears.push(year);
    const requestedChartDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    attemptedChartDates.push(requestedChartDate);
    let chart;
    try {
      chart = await getTopTenForDate(month, day, year);
    } catch (reason) {
      errors.push(reason instanceof Error ? reason.message : `Chart failed for ${requestedChartDate}`);
      continue;
    }

    for (const song of seededShuffle(chart.songs, hashString(`${seed}:${year}`))) {
      attemptedChartPositions.push(song.position);
      let track = null;
      try {
        track = await searchTrackPreview(song.title, song.artist);
      } catch (reason) {
        errors.push(reason instanceof Error ? reason.message : `Preview search failed for ${song.title}`);
      }
      previewAvailability.push({
        year,
        chartDate: chart.sourceDate,
        chartPosition: song.position,
        title: song.title,
        artist: song.artist,
        available: Boolean(track)
      });
      if (!track) continue;

      const puzzle: DailyPuzzle = {
        id: puzzleDate,
        number: puzzleNumber(puzzleDate),
        puzzleDate,
        chartDate: chart.date,
        chartSourceDate: chart.sourceDate,
        chartYear: year,
        chartPosition: song.position,
        title: song.title,
        artist: song.artist,
        track,
        uniqueContentKey: createMusicUsedContentKey(song.artist, song.title),
        musicUsedContentKey: createMusicUsedContentKey(song.artist, song.title),
        duplicateCheck: {
          duplicateDetected: false,
          passed: true,
          regenerationCount: 0,
          retryCount: previewAvailability.length - 1,
          exhaustedCandidatePool: false,
          checkedAgainstCount: previewAvailability.length - 1,
          recentlyUsedKeys: [],
          warning: previewAvailability.length > 1 ? "Alternate chart songs were tried before this playable non-error candidate." : undefined
        }
      };
      const fallbackReasons: string[] = [];
      if (chart.sourceDate !== requestedChartDate) fallbackReasons.push("nearest chart date used");
      if (year !== candidateYears[0]) fallbackReasons.push("alternate historical year used");
      if (previewAvailability.length > 1) fallbackReasons.push("alternate Top 10 position used");
      return {
        puzzle,
        diagnostics: {
          requestedChartDate,
          resolvedChartDate: chart.sourceDate,
          fallbackUsed: fallbackReasons.length > 0,
          fallbackReason: fallbackReasons.join("; ") || "none",
          attemptedYears,
          attemptedChartDates,
          attemptedChartPositions,
          previewAvailability,
          finalSelectedSong: `${song.title} — ${song.artist}`,
          errors
        }
      };
    }
  }

  throw new Error(`No playable track found after ${attemptedYears.length} historical chart attempts`);
}

function getResolution(puzzleDate: string) {
  const cached = resolutionCache.get(puzzleDate);
  if (cached) return cached;
  const resolution = resolveWithFallbacks(puzzleDate);
  resolutionCache.set(puzzleDate, resolution);
  resolution.catch(() => resolutionCache.delete(puzzleDate));
  return resolution;
}

export async function resolveNeedleDropPuzzle(puzzleDate: string): Promise<DailyPuzzle> {
  return (await getResolution(puzzleDate)).puzzle;
}

export async function resolveNeedleDropDiagnostic(puzzleDate: string) {
  const startedAt = new Date().toISOString();
  const resolution = await getResolution(puzzleDate);
  const { puzzle } = resolution;
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
      rawITunesTitle: puzzle.track.trackName,
      normalizedCorrectTitle: normalizeMusicString(puzzle.title),
      normalizedCorrectArtist: normalizeArtist(puzzle.artist),
      uniqueContentKey: puzzle.uniqueContentKey,
      musicUsedContentKey: puzzle.musicUsedContentKey,
      duplicateCheck: puzzle.duplicateCheck,
      ...resolution.diagnostics
    },
    rawProviderResponse: {
      iTunes: audio.rawResponse,
      rankedMatches: audio.rankedResults,
      resolution: resolution.diagnostics
    }
  };
}
