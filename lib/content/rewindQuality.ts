import { hashString, seededShuffle } from "@/lib/dailySeed";
import { normalizeArtist, normalizeMusicString } from "@/lib/normalize";

export type RewindRecognizabilityTier = "iconic" | "mainstream" | "challenging" | "reject";

export type RewindRecognizabilityInput = {
  chartPosition: number;
  chartAppearances?: number;
  distinctChartIssues?: number;
  artistDistinctHits?: number;
  artistChartAppearances?: number;
  chartYear?: number;
  currentYear?: number;
  previewAvailable?: boolean;
  originalRecordingConfidence?: number;
};

export type RewindRecognizability = {
  score: number;
  tier: RewindRecognizabilityTier;
  eligible: boolean;
  components: {
    chartPosition: number;
    chartRecurrence: number;
    artistFamiliarity: number;
    culturalFamiliarity: number;
    providerEvidence: number;
    sourceConfidence: number;
  };
  rejectionReasons: string[];
};

export type RewindRecordingInput = {
  title: string;
  artist: string;
  collectionName?: string;
  previewUrl?: string;
  expectedTitle?: string;
  expectedArtist?: string;
  requirePreview?: boolean;
};

export type RewindRecordingValidation = {
  valid: boolean;
  confidence: number;
  titleConfidence: number;
  artistConfidence: number;
  rejectionReasons: string[];
  alternateRecordingSignals: string[];
};

export const REWIND_HOLIDAY_COOLDOWN_DAYS = 7;

const HOLIDAY_SONG_PATTERN = /\b(?:christmas|xmas|santa|rudolph|reindeer|sleigh|mistletoe|jingle bells?|winter wonderland|feliz navidad|holy night|silent night|drummer boy|little saint nick|most wonderful time)\b/i;

export function isRewindSeasonalHolidaySong(title: string, collectionName = "") {
  return HOLIDAY_SONG_PATTERN.test(`${title} ${collectionName}`);
}

export function isRewindSeasonalCooldownActive(lastUsedDate: string | undefined, puzzleDate: string) {
  if (!lastUsedDate) return false;
  const usedAt = Date.parse(`${lastUsedDate}T12:00:00Z`);
  const puzzleAt = Date.parse(`${puzzleDate}T12:00:00Z`);
  if (!Number.isFinite(usedAt) || !Number.isFinite(puzzleAt)) return false;
  const elapsedDays = (puzzleAt - usedAt) / 86_400_000;
  return elapsedDays > 0 && elapsedDays < REWIND_HOLIDAY_COOLDOWN_DAYS;
}

export function resolveRewindOriginalReleaseProvenance(input: {
  originalReleaseYear?: number;
  originalReleaseYearSource?: string;
  providerReleaseDate?: string;
}) {
  const year = Number.isInteger(input.originalReleaseYear) && input.originalReleaseYear! >= 1880 && input.originalReleaseYear! <= 2200
    ? input.originalReleaseYear!
    : null;
  return {
    year,
    source: year ? input.originalReleaseYearSource ?? "recording-level source" : null,
    providerReleaseDate: input.providerReleaseDate ?? null,
    status: year
      ? `Original release year ${year} (${input.originalReleaseYearSource ?? "recording-level source"})`
      : "Original release year unavailable; chart year and provider catalog date are not used as substitutes."
  };
}

export type RewindInventoryMetrics = {
  discoveredUniqueTracks: number;
  providerResponsesExamined: number;
  metadataValidUniqueTracks: number;
  qualityApprovedUniqueTracks: number;
  previewPlayableUniqueTracks: number;
  previouslyUsedUniqueTracks: number;
  unusedEligibleUniqueTracks: number;
  rejectedProviderResponses: number;
  duplicateAliasesCollapsed: number;
};

export type RewindInventoryMetricInput = {
  discoveryProviderResponsesExamined: number;
  previewProviderResponsesExamined?: number;
  discoveredTrackKeys: Iterable<string>;
  metadataValidTrackKeys: Iterable<string>;
  qualityApprovedTrackKeys: Iterable<string>;
  previewPlayableTrackKeys: Iterable<string>;
  previouslyUsedTrackKeys: Iterable<string>;
  unusedEligibleTrackKeys: Iterable<string>;
  rejectedProviderResponses: number;
  duplicateAliasesCollapsed?: number;
};

export const REWIND_INVENTORY_METRIC_DEFINITIONS = {
  discoveredUniqueTracks: "Unique normalized artist-and-title identities returned by chart discovery.",
  providerResponsesExamined: "Chart rows plus bounded preview-provider results actually examined in this resolution.",
  metadataValidUniqueTracks: "Discovered unique tracks with a title, artist, and no alternate-recording marker.",
  previewPlayableUniqueTracks: "Metadata-valid tracks whose examined provider result had a playable original-recording preview.",
  qualityApprovedUniqueTracks: "Preview-playable tracks that also passed recognizability and original-recording quality gates.",
  previouslyUsedUniqueTracks: "Discovered tracks found in the permanent used-content registry within the checked window.",
  unusedEligibleUniqueTracks: "Examined preview-playable tracks that remained eligible after permanent duplicate checks.",
  rejectedProviderResponses: "Examined chart or preview results rejected by deterministic metadata, recording, or media checks.",
  duplicateAliasesCollapsed: "Repeated normalized artist-and-title chart rows collapsed during discovery."
} as const satisfies Record<keyof RewindInventoryMetrics, string>;

const RECORDING_VERSION_PATTERNS: Array<{ signal: string; pattern: RegExp }> = [
  { signal: "karaoke", pattern: /\bkaraoke\b/i },
  { signal: "tribute", pattern: /\b(?:tribute(?:\s+(?:act|artist|band|version))?|in the style of|made famous by)\b/i },
  { signal: "cover", pattern: /\b(?:cover version|cover of|covered by|acoustic cover)\b|(?:\(|\[|\s[-\u2013\u2014]\s)cover(?:\)|\]|$)/i },
  { signal: "live", pattern: /\b(?:live at|live from|live in|live on|live version|live recording|in concert|concert version)\b|(?:\(|\[|\s[-\u2013\u2014]\s)live(?:\)|\]|$)/i },
  { signal: "remix", pattern: /\b(?:remix(?:es|ed)?|club mix|dance mix|extended mix|festival mix|house mix|techno mix|radio mix|original mix|dub mix|mix edit)\b/i },
  { signal: "sped-up", pattern: /\b(?:sped[- ]?up|speed[- ]?up|nightcore|pitch(?:ed)? up)\b/i },
  { signal: "slowed", pattern: /\b(?:slowed(?:\s*(?:and|\+|&)\s*reverb)?|slowed[- ]?down|pitch(?:ed)? down)\b/i },
  { signal: "re-recorded", pattern: /\b(?:re[- ]?recorded|re[- ]?recording|new recording|taylor'?s version)\b/i },
  { signal: "instrumental", pattern: /\b(?:instrumental(?: version)?|backing track|minus one)\b/i },
  { signal: "alternate-take", pattern: /\b(?:alternate take|alternative take|demo(?: version)?|rough mix|session version|acoustic version|radio edit|single edit|edit version|different version)\b/i },
  { signal: "medley", pattern: /\bmedley\b/i }
];

const ATTRIBUTION_PATTERNS: Array<{ signal: string; pattern: RegExp }> = [
  { signal: "karaoke", pattern: /\bkaraoke\b/i },
  { signal: "tribute", pattern: /\b(?:tribute(?:\s+(?:act|artist|band))?|in the style of|made famous by)\b/i },
  { signal: "cover", pattern: /\bcover band\b/i }
];

function finiteNonNegativeInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`Rewind metric ${label} must be a non-negative integer.`);
}

function tokenSimilarity(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9;
  const leftWords = new Set(left.split(" ").filter(Boolean));
  const rightWords = new Set(right.split(" ").filter(Boolean));
  const intersection = [...leftWords].filter((word) => rightWords.has(word)).length;
  const union = new Set([...leftWords, ...rightWords]).size;
  return union ? intersection / union : 0;
}

function chartPositionPoints(position: number) {
  if (position === 1) return 46;
  if (position <= 5) return 42;
  if (position <= 10) return 38;
  if (position <= 20) return 32;
  if (position <= 40) return 24;
  if (position <= 60) return 17;
  if (position <= 75) return 10;
  if (position <= 90) return 6;
  return 2;
}

function recurrencePoints(appearances: number, issues: number) {
  const evidence = Math.max(appearances, issues);
  if (evidence >= 5) return 14;
  if (evidence === 4) return 12;
  if (evidence === 3) return 9;
  if (evidence === 2) return 5;
  return 0;
}

function artistFamiliarityPoints(distinctHits: number, chartAppearances: number) {
  const hitPoints = distinctHits >= 5 ? 8 : distinctHits === 4 ? 7 : distinctHits === 3 ? 5 : distinctHits === 2 ? 3 : 0;
  const appearancePoints = chartAppearances >= 10 ? 4 : chartAppearances >= 6 ? 3 : chartAppearances >= 3 ? 2 : 0;
  return Math.min(12, hitPoints + appearancePoints);
}

function culturalFamiliarityPoints(chartYear?: number, currentYear?: number) {
  if (!chartYear || !currentYear || chartYear > currentYear) return 4;
  const age = currentYear - chartYear;
  if (age <= 2) return 5;
  if (age <= 40) return 8;
  if (age <= 60) return 7;
  return 5;
}

export function scoreRewindRecognizability(input: RewindRecognizabilityInput): RewindRecognizability {
  if (!Number.isFinite(input.chartPosition) || input.chartPosition < 1 || input.chartPosition > 100) {
    return {
      score: 0,
      tier: "reject",
      eligible: false,
      components: { chartPosition: 0, chartRecurrence: 0, artistFamiliarity: 0, culturalFamiliarity: 0, providerEvidence: 0, sourceConfidence: 0 },
      rejectionReasons: ["Chart position must be between 1 and 100."]
    };
  }

  const appearances = Math.max(1, Math.floor(input.chartAppearances ?? 1));
  const issues = Math.max(1, Math.floor(input.distinctChartIssues ?? 1));
  const artistHits = Math.max(1, Math.floor(input.artistDistinctHits ?? 1));
  const artistAppearances = Math.max(1, Math.floor(input.artistChartAppearances ?? 1));
  const components = {
    chartPosition: chartPositionPoints(input.chartPosition),
    chartRecurrence: recurrencePoints(appearances, issues),
    artistFamiliarity: artistFamiliarityPoints(artistHits, artistAppearances),
    culturalFamiliarity: culturalFamiliarityPoints(input.chartYear, input.currentYear),
    providerEvidence: (input.previewAvailable ? 4 : 0) + (input.originalRecordingConfidence === undefined ? 0 : Math.round(Math.max(0, Math.min(1, input.originalRecordingConfidence)) * 6)),
    sourceConfidence: 12
  };
  const score = Math.max(0, Math.min(100, Object.values(components).reduce((sum, value) => sum + value, 0)));
  const rejectionReasons: string[] = [];
  if (input.chartPosition > 75 && appearances < 2 && artistHits < 3) {
    rejectionReasons.push("Low-chart track lacks recurrence or artist-familiarity evidence.");
  }
  if (input.chartPosition > 90 && appearances < 3 && artistHits < 4) {
    rejectionReasons.push("Bottom-ten chart track lacks strong additional popularity evidence.");
  }
  if (input.originalRecordingConfidence !== undefined && input.originalRecordingConfidence < 0.78) {
    rejectionReasons.push("Original-recording confidence is below 0.78.");
  }

  let tier: RewindRecognizabilityTier;
  if (rejectionReasons.length || score < 42) tier = "reject";
  else if (score >= 80) tier = "iconic";
  else if (score >= 60) tier = "mainstream";
  else tier = "challenging";
  return { score, tier, eligible: tier !== "reject", components, rejectionReasons };
}

export function validateRewindOriginalRecording(input: RewindRecordingInput): RewindRecordingValidation {
  const rejectionReasons: string[] = [];
  const recordingText = `${input.title} ${input.collectionName ?? ""}`.trim();
  const attributionText = `${input.artist} ${input.collectionName ?? ""}`.trim();
  const alternateRecordingSignals = [...new Set([
    ...RECORDING_VERSION_PATTERNS.filter(({ pattern }) => pattern.test(recordingText)).map(({ signal }) => signal),
    ...ATTRIBUTION_PATTERNS.filter(({ pattern }) => pattern.test(attributionText)).map(({ signal }) => signal)
  ])];

  if (!input.title.trim() || !input.artist.trim()) rejectionReasons.push("Title and artist are required.");
  if (input.requirePreview && !input.previewUrl) rejectionReasons.push("Playable preview URL is required.");
  if (alternateRecordingSignals.length) {
    rejectionReasons.push(`Alternate recording marker detected: ${alternateRecordingSignals.join(", ")}.`);
  }

  const titleConfidence = input.expectedTitle
    ? tokenSimilarity(normalizeMusicString(input.expectedTitle), normalizeMusicString(input.title))
    : input.title.trim() ? 1 : 0;
  const artistConfidence = input.expectedArtist
    ? tokenSimilarity(normalizeArtist(input.expectedArtist), normalizeArtist(input.artist))
    : input.artist.trim() ? 1 : 0;
  if (input.expectedTitle && titleConfidence < 0.72) rejectionReasons.push("Provider title does not match the selected chart song.");
  if (input.expectedArtist && artistConfidence < 0.62) rejectionReasons.push("Provider artist does not match the selected chart artist.");
  const confidence = Math.max(0, Math.min(1, titleConfidence * 0.68 + artistConfidence * 0.32));
  if ((input.expectedTitle || input.expectedArtist) && confidence < 0.78) {
    rejectionReasons.push("Combined original-recording identity confidence is below 0.78.");
  }
  return {
    valid: rejectionReasons.length === 0,
    confidence,
    titleConfidence,
    artistConfidence,
    rejectionReasons: [...new Set(rejectionReasons)],
    alternateRecordingSignals
  };
}

export function orderRewindCandidatesByRecognizability<T extends { recognizability: RewindRecognizability }>(
  candidates: readonly T[],
  seed: string | number,
  challengingRate = 0.15
) {
  const eligible = candidates.filter((candidate) => candidate.recognizability.eligible);
  const mainstream = seededShuffle(
    eligible.filter((candidate) => candidate.recognizability.tier === "iconic" || candidate.recognizability.tier === "mainstream"),
    hashString(`${seed}:rewind-mainstream`)
  );
  const challenging = seededShuffle(
    eligible.filter((candidate) => candidate.recognizability.tier === "challenging"),
    hashString(`${seed}:rewind-challenging`)
  );
  const clampedRate = Math.max(0, Math.min(1, challengingRate));
  const challengeFirst = challenging.length > 0 && hashString(`${seed}:rewind-tier`) % 10_000 < Math.round(clampedRate * 10_000);
  if (!challengeFirst) return [...mainstream, ...challenging];
  return [challenging[0], ...mainstream, ...challenging.slice(1)];
}

export function summarizeRewindRecognizabilityTiers(items: Iterable<{ recognizability: RewindRecognizability }>) {
  const distribution: Record<RewindRecognizabilityTier, number> = { iconic: 0, mainstream: 0, challenging: 0, reject: 0 };
  for (const item of items) distribution[item.recognizability.tier] += 1;
  return distribution;
}

function unique(values: Iterable<string>) {
  return new Set([...values].filter(Boolean));
}

function assertSubset(subset: Set<string>, superset: Set<string>, label: string) {
  const missing = [...subset].filter((key) => !superset.has(key));
  if (missing.length) throw new Error(`Rewind metric invariant failed: ${label} contains ${missing.length} identities outside its parent set.`);
}

export function assertRewindInventoryMetricInvariants(metrics: RewindInventoryMetrics) {
  for (const [label, value] of Object.entries(metrics)) finiteNonNegativeInteger(value, label);
  if (metrics.discoveredUniqueTracks > metrics.providerResponsesExamined) throw new Error("Rewind metric invariant failed: discovered unique tracks exceeds examined provider responses.");
  if (metrics.metadataValidUniqueTracks > metrics.discoveredUniqueTracks) throw new Error("Rewind metric invariant failed: metadata-valid exceeds discovered unique tracks.");
  if (metrics.previewPlayableUniqueTracks > metrics.metadataValidUniqueTracks) throw new Error("Rewind metric invariant failed: preview-playable exceeds metadata-valid tracks.");
  if (metrics.qualityApprovedUniqueTracks > metrics.previewPlayableUniqueTracks) throw new Error("Rewind metric invariant failed: quality-approved exceeds preview-playable tracks.");
  if (metrics.unusedEligibleUniqueTracks > metrics.qualityApprovedUniqueTracks) throw new Error("Rewind metric invariant failed: unused eligible exceeds quality-approved tracks.");
  if (metrics.previouslyUsedUniqueTracks > metrics.discoveredUniqueTracks) throw new Error("Rewind metric invariant failed: previously used exceeds discovered unique tracks.");
  if (metrics.duplicateAliasesCollapsed > metrics.providerResponsesExamined) throw new Error("Rewind metric invariant failed: collapsed aliases exceeds examined provider responses.");
  if (metrics.discoveredUniqueTracks + metrics.duplicateAliasesCollapsed > metrics.providerResponsesExamined) throw new Error("Rewind metric invariant failed: discovered tracks plus collapsed aliases exceeds examined provider responses.");
  if (metrics.rejectedProviderResponses > metrics.providerResponsesExamined) throw new Error("Rewind metric invariant failed: rejected responses exceeds examined provider responses.");
  return metrics;
}

export function aggregateRewindInventoryMetrics(input: RewindInventoryMetricInput): RewindInventoryMetrics {
  const discovered = unique(input.discoveredTrackKeys);
  const metadataValid = unique(input.metadataValidTrackKeys);
  const qualityApproved = unique(input.qualityApprovedTrackKeys);
  const previewPlayable = unique(input.previewPlayableTrackKeys);
  const previouslyUsed = unique(input.previouslyUsedTrackKeys);
  const unusedEligible = unique(input.unusedEligibleTrackKeys);
  assertSubset(metadataValid, discovered, "metadata-valid");
  assertSubset(previewPlayable, metadataValid, "preview-playable");
  assertSubset(qualityApproved, previewPlayable, "quality-approved");
  assertSubset(previouslyUsed, discovered, "previously-used");
  assertSubset(unusedEligible, qualityApproved, "unused-eligible");

  const discoveryResponses = Math.max(0, Math.floor(input.discoveryProviderResponsesExamined));
  const previewResponses = Math.max(0, Math.floor(input.previewProviderResponsesExamined ?? 0));
  const metrics: RewindInventoryMetrics = {
    discoveredUniqueTracks: discovered.size,
    providerResponsesExamined: discoveryResponses + previewResponses,
    metadataValidUniqueTracks: metadataValid.size,
    qualityApprovedUniqueTracks: qualityApproved.size,
    previewPlayableUniqueTracks: previewPlayable.size,
    previouslyUsedUniqueTracks: previouslyUsed.size,
    unusedEligibleUniqueTracks: unusedEligible.size,
    rejectedProviderResponses: Math.max(0, Math.floor(input.rejectedProviderResponses)),
    duplicateAliasesCollapsed: Math.max(0, Math.floor(input.duplicateAliasesCollapsed ?? Math.max(0, discoveryResponses - discovered.size)))
  };
  return assertRewindInventoryMetricInvariants(metrics);
}
