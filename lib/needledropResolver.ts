import { searchTrackPreview, searchTrackPreviewDiagnostic } from "@/lib/audioProvider";
import { getChartForDate } from "@/lib/chartProvider";
import { getGameSeedForDate, hashString, seededShuffle } from "@/lib/dailySeed";
import { puzzleNumber } from "@/lib/date";
import { normalizeArtist, normalizeMusicString } from "@/lib/normalize";
import type { DailyPuzzle, TrackPreview } from "@/types/game";
import { createMusicUsedContentKey, createUniqueContentKey } from "@/lib/content/usedContentRegistry";
import { checkUsedContentKeys, getUsedContentKeyDates } from "@/lib/content/persistence";

type SongCandidate = {
  year: number;
  requestedDate: string;
  chartDate: string;
  chartPosition: number;
  title: string;
  artist: string;
};

type PreviewAttempt = SongCandidate & { available: boolean; rejectionReason?: string };

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
  sourceUniverseSize: number;
  chartIssuesConsidered: number;
  songsConsidered: number;
  previewAvailabilityRejectionCount: number;
  duplicateRejectionCount: number;
  metadataRejectionCount: number;
  finalCandidateCount: number;
  candidateBatchSizes: number[];
  providerApiCalls: number;
  duplicateCheckBatches: number;
  cooldownRejectionCount: number;
};

type Resolution = { puzzle: DailyPuzzle; diagnostics: ResolutionDiagnostics };
const resolutionCache = new Map<string, Promise<Resolution>>();
const BAD_RECORDING = /\b(karaoke|tribute|in the style of|made famous by|cover version|live at|live from|remix|re-recorded|instrumental version)\b/i;

function shiftUtcDate(year: number, month: number, day: number, offset: number) {
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

async function fetchCandidateUniverse(puzzleDate: string, seed: number) {
  const [currentYear, month, day] = puzzleDate.split("-").map(Number);
  const years = Array.from({ length: Math.max(0, currentYear - 1958) }, (_, index) => 1958 + index);
  const offsets = [-154, -126, -98, -70, -42, -14, 14, 42, 70, 98, 126, 154];
  const issueRequests = seededShuffle(
    years.flatMap((year) => offsets.map((offset) => ({ year, offset }))),
    seed
  ).slice(0, 32);
  const settled = await Promise.allSettled(issueRequests.map(async ({ year, offset }) => {
    const shifted = shiftUtcDate(year, month, day, offset);
    const chart = await getChartForDate(shifted.month, shifted.day, shifted.year);
    return chart.songs.map((song) => ({
      year: shifted.year,
      requestedDate: chart.date,
      chartDate: chart.sourceDate,
      chartPosition: song.position,
      title: song.title,
      artist: song.artist
    }));
  }));
  const errors = settled.flatMap((result) => result.status === "rejected"
    ? [result.reason instanceof Error ? result.reason.message : "Chart issue unavailable"] : []);
  const seen = new Set<string>();
  const candidates = settled.flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .filter((candidate) => {
      const key = createMusicUsedContentKey(candidate.artist, candidate.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return { candidates: seededShuffle(candidates, hashString(`${seed}:rewind-candidates`)), errors, issueCount: settled.filter((result) => result.status === "fulfilled").length };
}

async function resolveWithFallbacks(puzzleDate: string): Promise<Resolution> {
  const seed = getGameSeedForDate(puzzleDate, "needledrop");
  const universe = await fetchCandidateUniverse(puzzleDate, seed);
  const errors = [...universe.errors];
  const metadataRejected: SongCandidate[] = [];
  const metadataValid = universe.candidates.filter((candidate) => {
    const invalid = !candidate.title.trim() || !candidate.artist.trim() || BAD_RECORDING.test(`${candidate.title} ${candidate.artist}`);
    if (invalid) metadataRejected.push(candidate);
    return !invalid;
  });
  const previewAvailability: PreviewAttempt[] = [];
  let providerApiCalls = 0;
  let selected: { candidate: SongCandidate; track: TrackPreview } | null = null;
  const batchSizes: number[] = [];
  let duplicateKeysChecked = 0;
  let duplicateRejected = 0;
  let duplicateCheckBatches = 0;
  let finalCandidateCount = 0;
  let cooldownRejectionCount = 0;

  for (let sourceIndex = 0; sourceIndex < metadataValid.length && !selected; sourceIndex += 250) {
    const sourceBatch = metadataValid.slice(sourceIndex, sourceIndex + 250);
    const keysByCandidate = new Map<SongCandidate, string[]>();
    const duplicateKeys = sourceBatch.flatMap((candidate) => {
      const keys = [
        createUniqueContentKey("rewind-song", "song", [candidate.artist, candidate.title]),
        createMusicUsedContentKey(candidate.artist, candidate.title)
      ];
      keysByCandidate.set(candidate, keys);
      return keys;
    });
    duplicateKeysChecked += duplicateKeys.length;
    duplicateCheckBatches += Math.ceil(duplicateKeys.length / 100);
    const usedKeys = new Set(await checkUsedContentKeys(duplicateKeys));
    const unused = sourceBatch.filter((candidate) => !(keysByCandidate.get(candidate) ?? []).some((key) => usedKeys.has(key)));
    duplicateRejected += sourceBatch.length - unused.length;
    finalCandidateCount += unused.length;
    const artistKeys = unused.map((candidate) => createUniqueContentKey("needledrop", "artist-soft", [candidate.artist]));
    const artistDates = await getUsedContentKeyDates(artistKeys);
    const cutoff = Date.parse(`${puzzleDate}T12:00:00Z`) - 45 * 86_400_000;
    const strictUnused = unused.filter((candidate) => {
      const usedDate = artistDates.get(createUniqueContentKey("needledrop", "artist-soft", [candidate.artist]));
      return !usedDate || Date.parse(`${usedDate}T12:00:00Z`) < cutoff;
    });
    cooldownRejectionCount += unused.length - strictUnused.length;
    const previewCandidates = strictUnused.length ? strictUnused : unused;

    for (let index = 0; index < previewCandidates.length && !selected; index += 12) {
      const batch = previewCandidates.slice(index, index + 12);
      batchSizes.push(batch.length);
      providerApiCalls += batch.length;
      const previews = await Promise.all(batch.map(async (candidate) => {
        try {
          const track = await searchTrackPreview(candidate.title, candidate.artist);
          if (!track?.previewUrl) return { candidate, track: null, reason: "preview unavailable" };
          if (BAD_RECORDING.test(`${track.trackName} ${track.artistName} ${track.collectionName}`)) {
            return { candidate, track: null, reason: "alternate recording rejected" };
          }
          return { candidate, track, reason: undefined };
        } catch (error) {
          return { candidate, track: null, reason: error instanceof Error ? error.message : "preview provider failed" };
        }
      }));
      for (const result of previews) {
        previewAvailability.push({ ...result.candidate, available: Boolean(result.track), rejectionReason: result.reason });
        if (!selected && result.track) selected = { candidate: result.candidate, track: result.track };
      }
      if (batchSizes.length >= 8 && !selected) errors.push(`No playable result in ${batchSizes.reduce((sum, size) => sum + size, 0)} preview-validated candidates; expanded search continues.`);
    }
  }

  const finalSelection = selected as { candidate: SongCandidate; track: TrackPreview } | null;
  if (!finalSelection) {
    throw new Error(`Rewind exhausted all configured sources. Chart issues: ${universe.issueCount}; songs: ${universe.candidates.length}; metadata rejected: ${metadataRejected.length}; duplicate rejected: ${duplicateRejected}; previews tested: ${previewAvailability.length}; preview rejected: ${previewAvailability.filter((entry) => !entry.available).length}; provider errors: ${errors.join(" | ") || "none"}.`);
  }

  const { candidate: song, track } = finalSelection;
  const uniqueContentKey = createUniqueContentKey("rewind-song", "song", [song.artist, song.title]);
  const musicUsedContentKey = createMusicUsedContentKey(song.artist, song.title);
  const artistCooldownKey = createUniqueContentKey("needledrop", "artist-soft", [song.artist]);
  const puzzle: DailyPuzzle = {
    id: puzzleDate,
    number: puzzleNumber(puzzleDate),
    puzzleDate,
    chartDate: song.requestedDate,
    chartSourceDate: song.chartDate,
    chartYear: song.year,
    chartPosition: song.chartPosition,
    title: song.title,
    artist: song.artist,
    track,
    uniqueContentKey,
    secondaryKeys: [musicUsedContentKey, artistCooldownKey],
    musicUsedContentKey,
    duplicateCheck: {
      duplicateDetected: false,
      passed: true,
      regenerationCount: 0,
      retryCount: previewAvailability.length - 1,
      exhaustedCandidatePool: false,
      checkedAgainstCount: duplicateKeysChecked,
      recentlyUsedKeys: [],
      warning: previewAvailability.length > 1 ? "A large candidate batch was filtered before selecting this playable original recording." : undefined
    }
  };
  const diagnostics: ResolutionDiagnostics = {
    requestedChartDate: song.requestedDate,
    resolvedChartDate: song.chartDate,
    fallbackUsed: true,
    fallbackReason: "deterministic selection from multiple chart issues, positions, decades, and preview-validated candidates",
    attemptedYears: [...new Set(universe.candidates.map((candidate) => candidate.year))],
    attemptedChartDates: [...new Set(universe.candidates.map((candidate) => candidate.chartDate))],
    attemptedChartPositions: [...new Set(previewAvailability.map((candidate) => candidate.chartPosition))],
    previewAvailability,
    finalSelectedSong: `${song.title} — ${song.artist}`,
    errors,
    sourceUniverseSize: universe.candidates.length,
    chartIssuesConsidered: universe.issueCount,
    songsConsidered: universe.candidates.length,
    previewAvailabilityRejectionCount: previewAvailability.filter((entry) => !entry.available).length,
    duplicateRejectionCount: duplicateRejected,
    metadataRejectionCount: metadataRejected.length,
    finalCandidateCount,
    candidateBatchSizes: batchSizes,
    providerApiCalls,
    duplicateCheckBatches,
    cooldownRejectionCount
  };
  return { puzzle, diagnostics };
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
      sourceProvider: "Billboard multi-issue archive + iTunes Search API",
      generatedAt: startedAt,
      rawITunesTitle: puzzle.track.trackName,
      normalizedCorrectTitle: normalizeMusicString(puzzle.title),
      normalizedCorrectArtist: normalizeArtist(puzzle.artist),
      uniqueContentKey: puzzle.uniqueContentKey,
      musicUsedContentKey: puzzle.musicUsedContentKey,
      duplicateCheck: puzzle.duplicateCheck,
      ...resolution.diagnostics
    },
    rawProviderResponse: { iTunes: audio.rawResponse, rankedMatches: audio.rankedResults, resolution: resolution.diagnostics }
  };
}
