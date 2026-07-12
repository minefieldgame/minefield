import { searchTrackPreview, searchTrackPreviewDiagnostic } from "@/lib/audioProvider";
import { getChartForDate, historicalChartAnchorDate } from "@/lib/chartProvider";
import { getGameSeedForDate, hashString, seededShuffle } from "@/lib/dailySeed";
import { puzzleNumber } from "@/lib/date";
import { normalizeArtist, normalizeMusicString } from "@/lib/normalize";
import type { DailyPuzzle, TrackPreview } from "@/types/game";
import { createMusicUsedContentKey, createUniqueContentKey } from "@/lib/content/usedContentRegistry";
import { checkUsedContentKeys, getUsedContentKeyDates } from "@/lib/content/persistence";
import {
  aggregateRewindInventoryMetrics,
  orderRewindCandidatesByRecognizability,
  REWIND_INVENTORY_METRIC_DEFINITIONS,
  scoreRewindRecognizability,
  summarizeRewindRecognizabilityTiers,
  validateRewindOriginalRecording,
  type RewindInventoryMetrics,
  type RewindRecognizability
} from "@/lib/content/rewindQuality";

type DiscoveredSongCandidate = {
  year: number;
  requestedDate: string;
  chartDate: string;
  chartDateDeltaDays: number;
  fallbackWindowDays: number;
  chartPosition: number;
  title: string;
  artist: string;
};

type SongCandidate = DiscoveredSongCandidate & {
  musicIdentityKey: string;
  chartAppearances: number;
  distinctChartIssues: number;
  artistDistinctHits: number;
  artistChartAppearances: number;
  recognizability: RewindRecognizability;
};

type PreviewAttempt = SongCandidate & {
  available: boolean;
  rejectionReason?: string;
  originalRecordingConfidence?: number;
};

type PreviewResult = {
  candidate: SongCandidate;
  track: TrackPreview | null;
  reason?: string;
  rejectionKind?: "preview" | "recording" | "recognizability" | "provider";
  originalRecordingConfidence?: number;
  previewPlayable?: boolean;
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
  providerResponsesExamined: number;
  duplicateAliasesCollapsed: number;
  recognizabilityRejectionCount: number;
  originalRecordingRejectionCount: number;
  recognizabilityScore: number;
  recognizabilityTier: RewindRecognizability["tier"];
  recognizabilityTierDistribution: ReturnType<typeof summarizeRewindRecognizabilityTiers>;
  inventoryMetrics: RewindInventoryMetrics;
  inventoryMetricDefinitions: typeof REWIND_INVENTORY_METRIC_DEFINITIONS;
  inventoryMetricsScope: string;
  selectedDailyDate: string;
  historicalYearSelected: number;
  targetHistoricalMonthDay: string;
  requestedHistoricalChartDate: string;
  resolvedBillboardIssueDate: string;
  chartDateDeltaDays: number;
  fallbackWindowDays: number;
};

type Resolution = { puzzle: DailyPuzzle; diagnostics: ResolutionDiagnostics };
const resolutionCache = new Map<string, Promise<Resolution>>();
export type RewindInventorySnapshot = {
  date: string;
  metrics: RewindInventoryMetrics;
  tierDistribution: ReturnType<typeof summarizeRewindRecognizabilityTiers>;
  capturedAt: string;
};
let latestInventorySnapshot: RewindInventorySnapshot | null = null;

export function getLatestRewindInventorySnapshot() {
  return latestInventorySnapshot;
}

export function clearNeedleDropResolutionCache(puzzleDate: string) {
  resolutionCache.delete(puzzleDate);
}

export async function fetchDateAnchoredCandidateUniverse(puzzleDate: string, seed: number) {
  const [currentYear] = puzzleDate.split("-").map(Number);
  const years = Array.from({ length: Math.max(0, currentYear - 1958) }, (_, index) => 1958 + index)
    .filter((year) => year < currentYear);
  const issueRequests = seededShuffle(years, seed).slice(0, 32);
  const settled = await Promise.allSettled(issueRequests.map(async (year) => {
    const anchor = historicalChartAnchorDate(puzzleDate, year);
    const [, anchorMonth, anchorDay] = anchor.split("-").map(Number);
    const chart = await getChartForDate(anchorMonth, anchorDay, year, { maxWindowDays: 14 });
    return chart.songs.map((song) => ({
      year,
      requestedDate: chart.date,
      chartDate: chart.sourceDate,
      chartDateDeltaDays: chart.dateDeltaDays,
      fallbackWindowDays: chart.fallbackWindowDays,
      chartPosition: song.position,
      title: song.title,
      artist: song.artist
    }));
  }));
  const errors = settled.flatMap((result) => result.status === "rejected"
    ? [result.reason instanceof Error ? result.reason.message : "Chart issue unavailable"] : []);
  const providerResponses = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const tracksByIdentity = new Map<string, DiscoveredSongCandidate[]>();
  for (const candidate of providerResponses) {
    const identityKey = createMusicUsedContentKey(candidate.artist, candidate.title);
    const aliases = tracksByIdentity.get(identityKey) ?? [];
    aliases.push(candidate);
    tracksByIdentity.set(identityKey, aliases);
  }

  const artistTrackKeys = new Map<string, Set<string>>();
  const artistChartAppearances = new Map<string, number>();
  for (const [identityKey, aliases] of tracksByIdentity) {
    const artistKey = normalizeArtist(aliases[0]?.artist ?? "");
    const trackKeys = artistTrackKeys.get(artistKey) ?? new Set<string>();
    trackKeys.add(identityKey);
    artistTrackKeys.set(artistKey, trackKeys);
    artistChartAppearances.set(artistKey, (artistChartAppearances.get(artistKey) ?? 0) + aliases.length);
  }

  const candidates: SongCandidate[] = [...tracksByIdentity.entries()].map(([musicIdentityKey, aliases]) => {
    const representative = [...aliases].sort((left, right) => left.chartPosition - right.chartPosition || left.chartDate.localeCompare(right.chartDate))[0];
    const artistKey = normalizeArtist(representative.artist);
    const chartAppearances = aliases.length;
    const distinctChartIssues = new Set(aliases.map((candidate) => candidate.chartDate)).size;
    const artistDistinctHits = artistTrackKeys.get(artistKey)?.size ?? 1;
    const artistAppearances = artistChartAppearances.get(artistKey) ?? chartAppearances;
    return {
      ...representative,
      musicIdentityKey,
      chartAppearances,
      distinctChartIssues,
      artistDistinctHits,
      artistChartAppearances: artistAppearances,
      recognizability: scoreRewindRecognizability({
        chartPosition: representative.chartPosition,
        chartAppearances,
        distinctChartIssues,
        artistDistinctHits,
        artistChartAppearances: artistAppearances,
        chartYear: representative.year,
        currentYear
      })
    };
  });
  return {
    candidates: seededShuffle(candidates, hashString(`${seed}:rewind-candidates`)),
    errors,
    issueCount: settled.filter((result) => result.status === "fulfilled").length,
    providerResponsesExamined: providerResponses.length,
    duplicateAliasesCollapsed: Math.max(0, providerResponses.length - candidates.length)
  };
}

async function resolveWithFallbacks(puzzleDate: string): Promise<Resolution> {
  const seed = getGameSeedForDate(puzzleDate, "needledrop");
  const universe = await fetchDateAnchoredCandidateUniverse(puzzleDate, seed);
  const errors = [...universe.errors];
  const metadataRejected: SongCandidate[] = [];
  const metadataValid = universe.candidates.filter((candidate) => {
    const recording = validateRewindOriginalRecording({ title: candidate.title, artist: candidate.artist });
    if (!recording.valid) metadataRejected.push(candidate);
    return recording.valid;
  });
  const recognizabilityRejected = metadataValid.filter((candidate) => !candidate.recognizability.eligible);
  const qualityApproved = orderRewindCandidatesByRecognizability(
    metadataValid.filter((candidate) => candidate.recognizability.eligible),
    `${puzzleDate}:${seed}:recognizability`
  );
  const previewAvailability: PreviewAttempt[] = [];
  let providerApiCalls = 0;
  let selected: { candidate: SongCandidate; track: TrackPreview } | null = null;
  const batchSizes: number[] = [];
  let duplicateKeysChecked = 0;
  let duplicateRejected = 0;
  let duplicateCheckBatches = 0;
  let finalCandidateCount = 0;
  let cooldownRejectionCount = 0;
  let originalRecordingRejectionCount = metadataRejected.length;
  let previewRecognizabilityRejectionCount = 0;
  const previouslyUsedTrackKeys = new Set<string>();
  const previewPlayableTrackKeys = new Set<string>();
  const qualityApprovedTrackKeys = new Set<string>();
  const unusedEligibleTrackKeys = new Set<string>();

  for (let sourceIndex = 0; sourceIndex < qualityApproved.length && !selected; sourceIndex += 250) {
    const sourceBatch = qualityApproved.slice(sourceIndex, sourceIndex + 250);
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
    const unused = sourceBatch.filter((candidate) => {
      const used = (keysByCandidate.get(candidate) ?? []).some((key) => usedKeys.has(key));
      if (used) previouslyUsedTrackKeys.add(candidate.musicIdentityKey);
      return !used;
    });
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
      const previews: PreviewResult[] = await Promise.all(batch.map(async (candidate): Promise<PreviewResult> => {
        try {
          const track = await searchTrackPreview(candidate.title, candidate.artist);
          if (!track?.previewUrl) return { candidate, track: null, reason: "preview unavailable", rejectionKind: "preview" };
          const recording = validateRewindOriginalRecording({
            title: track.trackName,
            artist: track.artistName,
            collectionName: track.collectionName,
            previewUrl: track.previewUrl,
            expectedTitle: candidate.title,
            expectedArtist: candidate.artist,
            requirePreview: true
          });
          if (!recording.valid) {
            return {
              candidate,
              track: null,
              reason: recording.rejectionReasons.join(" "),
              rejectionKind: "recording",
              originalRecordingConfidence: recording.confidence
            };
          }
          const recognizability = scoreRewindRecognizability({
            chartPosition: candidate.chartPosition,
            chartAppearances: candidate.chartAppearances,
            distinctChartIssues: candidate.distinctChartIssues,
            artistDistinctHits: candidate.artistDistinctHits,
            artistChartAppearances: candidate.artistChartAppearances,
            chartYear: candidate.year,
            currentYear: Number(puzzleDate.slice(0, 4)),
            previewAvailable: true,
            originalRecordingConfidence: recording.confidence
          });
          const scoredCandidate = { ...candidate, recognizability };
          if (!recognizability.eligible) {
            return {
              candidate: scoredCandidate,
              track: null,
              reason: recognizability.rejectionReasons.join(" ") || "recognizability quality gate rejected candidate",
              rejectionKind: "recognizability",
              originalRecordingConfidence: recording.confidence,
              previewPlayable: true
            };
          }
          return { candidate: scoredCandidate, track, originalRecordingConfidence: recording.confidence, previewPlayable: true };
        } catch (error) {
          return { candidate, track: null, reason: error instanceof Error ? error.message : "preview provider failed", rejectionKind: "provider" };
        }
      }));
      for (const result of previews) {
        previewAvailability.push({
          ...result.candidate,
          available: Boolean(result.track),
          rejectionReason: result.reason,
          originalRecordingConfidence: result.originalRecordingConfidence
        });
        if (result.rejectionKind === "recording") originalRecordingRejectionCount += 1;
        if (result.rejectionKind === "recognizability") previewRecognizabilityRejectionCount += 1;
        if (result.previewPlayable) previewPlayableTrackKeys.add(result.candidate.musicIdentityKey);
        if (result.track) {
          qualityApprovedTrackKeys.add(result.candidate.musicIdentityKey);
          unusedEligibleTrackKeys.add(result.candidate.musicIdentityKey);
          if (!selected) selected = { candidate: result.candidate, track: result.track };
        }
      }
      if (batchSizes.length >= 8 && !selected) errors.push(`No playable result in ${batchSizes.reduce((sum, size) => sum + size, 0)} preview-validated candidates; expanded search continues.`);
    }
  }

  const finalSelection = selected as { candidate: SongCandidate; track: TrackPreview } | null;
  if (!finalSelection) {
    throw new Error(`Rewind exhausted all configured sources. Chart issues: ${universe.issueCount}; discovered unique tracks: ${universe.candidates.length}; metadata rejected: ${metadataRejected.length}; recognizability rejected: ${recognizabilityRejected.length}; duplicate rejected: ${duplicateRejected}; previews tested: ${previewAvailability.length}; preview rejected: ${previewAvailability.filter((entry) => !entry.available).length}; provider errors: ${errors.join(" | ") || "none"}.`);
  }

  const { candidate: song, track } = finalSelection;
  const inventoryMetrics = aggregateRewindInventoryMetrics({
    discoveryProviderResponsesExamined: universe.providerResponsesExamined,
    previewProviderResponsesExamined: previewAvailability.length,
    discoveredTrackKeys: universe.candidates.map((candidate) => candidate.musicIdentityKey),
    metadataValidTrackKeys: metadataValid.map((candidate) => candidate.musicIdentityKey),
    qualityApprovedTrackKeys,
    previewPlayableTrackKeys,
    previouslyUsedTrackKeys,
    unusedEligibleTrackKeys,
    rejectedProviderResponses: metadataRejected.length + previewAvailability.filter((entry) => !entry.available).length,
    duplicateAliasesCollapsed: universe.duplicateAliasesCollapsed
  });
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
    fallbackReason: `deterministic selection from historical chart issues anchored to ${puzzleDate.slice(5)} within a ${song.fallbackWindowDays}-day window`,
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
    cooldownRejectionCount,
    providerResponsesExamined: inventoryMetrics.providerResponsesExamined,
    duplicateAliasesCollapsed: inventoryMetrics.duplicateAliasesCollapsed,
    recognizabilityRejectionCount: recognizabilityRejected.length + previewRecognizabilityRejectionCount,
    originalRecordingRejectionCount,
    recognizabilityScore: song.recognizability.score,
    recognizabilityTier: song.recognizability.tier,
    recognizabilityTierDistribution: summarizeRewindRecognizabilityTiers(universe.candidates),
    inventoryMetrics,
    inventoryMetricDefinitions: REWIND_INVENTORY_METRIC_DEFINITIONS,
    inventoryMetricsScope: "Discovery totals cover same-week historical chart issues; used and preview-playable totals cover only duplicate/media batches examined before selection.",
    selectedDailyDate: puzzleDate,
    historicalYearSelected: song.year,
    targetHistoricalMonthDay: puzzleDate.slice(5),
    requestedHistoricalChartDate: song.requestedDate,
    resolvedBillboardIssueDate: song.chartDate,
    chartDateDeltaDays: song.chartDateDeltaDays,
    fallbackWindowDays: song.fallbackWindowDays
  };
  latestInventorySnapshot = {
    date: puzzleDate,
    metrics: inventoryMetrics,
    tierDistribution: diagnostics.recognizabilityTierDistribution,
    capturedAt: new Date().toISOString()
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
      sourceProvider: "Same-week Billboard history + iTunes Search API",
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
