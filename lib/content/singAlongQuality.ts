import type { SingAlongCatalogEntry } from "@/data/singAlongCatalog";
import { normalizeUsedContentText } from "@/lib/content/usedContentRegistry";
import {
  providerHasPublicationCapabilities,
  type SingAlongTimingLookup,
  type SingAlongTimingProviderResult
} from "@/lib/content/singAlongTimingProvider";

const MAX_VERIFICATION_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_TIMING_CONFIDENCE = 0.8;
const DISALLOWED_VERSION_TEXT = /\b(?:karaoke|tribute|cover version|remix|re-recorded|instrumental|sped[ -]?up|slowed(?:[ -]and[ -]reverbed)?)\b|(?:\(|-|–)\s*live\b|\blive (?:at|from|version)\b/i;
const ALLOWED_USAGE = new Set(["licensed-preview-and-lyrics", "project-owned", "public-domain"]);

export function hasDisallowedSingAlongRecordingVersion(value: string) {
  return DISALLOWED_VERSION_TEXT.test(value);
}

function finite(value: number) {
  return Number.isFinite(value);
}

function normalizedWords(value: string) {
  return normalizeUsedContentText(value).split(/\s+/).filter(Boolean);
}

function isFreshVerification(value: string, now: number) {
  const verifiedAt = Date.parse(value);
  return Number.isFinite(verifiedAt) && verifiedAt <= now + 5 * 60 * 1000 && now - verifiedAt <= MAX_VERIFICATION_AGE_MS;
}

export type SingAlongTimingValidation = {
  valid: boolean;
  errors: string[];
  metadataTimingValidated: boolean;
  audioSemanticVerified: false;
};

export function validateSingAlongProviderResult(
  result: SingAlongTimingProviderResult,
  input?: SingAlongTimingLookup,
  now = Date.now()
): SingAlongTimingValidation {
  const errors: string[] = [];
  const answerText = result.answerCueText?.trim() || result.answerRepresentation.displayText.trim();
  const normalizedAnswer = normalizeUsedContentText(answerText);
  const normalizedTitle = normalizeUsedContentText(result.songIdentity.title);
  const normalizedContext = normalizeUsedContentText(result.lyricCueText);
  const gap = result.answerCueStartSeconds - result.lyricCueEndSeconds;
  const clipLength = result.lyricCueEndSeconds - result.lyricCueStartSeconds;

  if (!providerHasPublicationCapabilities(result.capabilities)) errors.push("provider lacks required synchronized-preview publication capabilities");
  if (!result.songIdentity.providerSongId.trim() || !result.songIdentity.title.trim()) errors.push("stable song identity is required");
  if (!result.artistIdentity.providerArtistId.trim() || !result.artistIdentity.name.trim()) errors.push("stable artist identity is required");
  if (!result.recordingIdentity.providerRecordingId.trim() && !result.recordingIdentity.isrc?.trim()) errors.push("stable recording identity or ISRC is required");
  if (!['original', 'intended-remaster'].includes(result.recordingIdentity.version)) errors.push("live, cover, remix, karaoke, sped-up, slowed, and other mismatched versions are ineligible");
  if (hasDisallowedSingAlongRecordingVersion(`${result.songIdentity.title} ${result.artistIdentity.name}`)) errors.push("recording metadata indicates an alternate version");

  if (input) {
    if (normalizeUsedContentText(input.title) !== normalizedTitle) errors.push("provider song identity does not match the discovered song");
    if (normalizeUsedContentText(input.artist) !== normalizeUsedContentText(result.artistIdentity.name)) errors.push("provider artist identity does not match the discovered artist");
    if (!result.recordingIdentity.matchedSourceRecordingIds.includes(input.sourceRecordingId)) errors.push("provider recording identity does not match the discovered recording");
  }

  try {
    const preview = new URL(result.previewUrl);
    if (preview.protocol !== "https:") errors.push("preview URL must use HTTPS");
  } catch {
    errors.push("preview URL is invalid");
  }
  if (!finite(result.previewDurationSeconds) || result.previewDurationSeconds < 10 || result.previewDurationSeconds > 120) errors.push("preview duration is outside the supported range");
  if (![result.lyricCueStartSeconds, result.lyricCueEndSeconds, result.answerCueStartSeconds, result.answerCueEndSeconds].every(finite)) errors.push("all cue timestamps must be finite");
  if (!(result.lyricCueStartSeconds >= 0 && result.lyricCueStartSeconds < result.lyricCueEndSeconds)) errors.push("lyric cue timestamps are out of order");
  if (!(result.lyricCueEndSeconds < result.answerCueStartSeconds && result.answerCueStartSeconds < result.answerCueEndSeconds)) errors.push("setup cue must end before the answer cue");
  if (!(gap >= 0.25 && gap <= 1)) errors.push("clip must end 0.25-1.0 seconds before the answer cue");
  if (!(clipLength >= 8 && clipLength <= 15)) errors.push("preceding clip must contain 8-15 seconds of context");
  if (!(result.answerCueEndSeconds <= result.previewDurationSeconds && result.lyricCueEndSeconds <= result.previewDurationSeconds)) errors.push("cue timestamps exceed preview duration");

  if (normalizedWords(result.lyricCueText).length < 4) errors.push("cue lacks sufficient preceding lyrical context");
  if (!normalizedContext || normalizedContext === normalizedAnswer || normalizedContext.includes(normalizedAnswer)) errors.push("answer is already present in the setup cue");
  if (!normalizedAnswer) errors.push("a compliant answer representation is required");
  if (normalizedAnswer === normalizedTitle) errors.push("song-title continuation is too trivial");
  if (result.ambiguityAssessment !== "unambiguous") errors.push("continuation must be explicitly unambiguous");

  if (result.choices.length !== 4 || result.choices.filter((choice) => choice.isCorrect).length !== 1) errors.push("exactly four provider-supplied choices and one correct choice are required");
  const normalizedChoices = result.choices.map((choice) => normalizeUsedContentText(choice.text));
  if (new Set(normalizedChoices).size !== 4) errors.push("provider-supplied choices must be distinct");
  const correctChoice = result.choices.find((choice) => choice.isCorrect);
  const acceptedAnswers = new Set([answerText, ...result.answerRepresentation.acceptedTexts].map(normalizeUsedContentText));
  if (!correctChoice || !acceptedAnswers.has(normalizeUsedContentText(correctChoice.text))) errors.push("correct choice does not match the compliant answer representation");

  if (!finite(result.timingConfidence) || result.timingConfidence < MIN_TIMING_CONFIDENCE || result.timingConfidence > 1) errors.push("timing confidence is below the publication threshold");
  if (!result.sourceProvider.trim()) errors.push("source provider is required");
  if (!ALLOWED_USAGE.has(result.usageClassification)) errors.push("license or usage classification does not permit publication");
  if (!result.licenseReference.trim()) errors.push("license reference is required");
  if (!isFreshVerification(result.lastVerifiedAt, now)) errors.push("provider verification is missing or stale");
  if (!result.verificationClaims.previewLoaded) errors.push("preview URL has not been load-verified");
  if (!result.verificationClaims.recordingIdentityMatched) errors.push("recording identity has not been verified");
  if (result.verificationClaims.audioSemanticVerified !== false) errors.push("audio semantic verification must not be claimed by this deterministic pipeline");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.chartIdentity.chartDate) || !Number.isInteger(result.chartIdentity.chartYear) ||
      result.chartIdentity.chartYear < 1958 || !Number.isInteger(result.chartIdentity.chartPosition) ||
      result.chartIdentity.chartPosition < 1 || result.chartIdentity.chartPosition > 100) {
    errors.push("source-backed chart identity is required by the current puzzle schema");
  }

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    metadataTimingValidated: errors.length === 0,
    audioSemanticVerified: false
  };
}

export function providerResultToSingAlongEntry(result: SingAlongTimingProviderResult): SingAlongCatalogEntry {
  const answerText = result.answerCueText?.trim() || result.answerRepresentation.displayText.trim();
  return {
    title: result.songIdentity.title,
    artist: result.artistIdentity.name,
    chartYear: result.chartIdentity.chartYear,
    chartDate: result.chartIdentity.chartDate,
    chartPosition: result.chartIdentity.chartPosition,
    playbackStart: result.lyricCueStartSeconds,
    playbackStop: result.lyricCueEndSeconds,
    chorusTimestamp: result.answerCueStartSeconds,
    cueDescription: "The clip ends just before the next lyric begins.",
    setupLyricExcerpt: result.lyricCueText,
    answerLyricExcerpt: answerText,
    answerLyricStartTimeSeconds: result.answerCueStartSeconds,
    clipStartTimeSeconds: result.lyricCueStartSeconds,
    clipEndTimeSeconds: result.lyricCueEndSeconds,
    acceptedLyric: answerText,
    alternateAcceptedLyrics: [...new Set(result.answerRepresentation.acceptedTexts)],
    correctChoiceId: result.choices.find((choice) => choice.isCorrect)?.id ?? "a",
    choices: result.choices,
    sourceNote: `${result.sourceProvider}; ${result.usageClassification}; license ${result.licenseReference}; verified ${result.lastVerifiedAt}. Timing validation is metadata-based and does not claim audio-semantic verification.`,
    eligibilityState: "playable",
    providerResult: result,
    rejectionReasons: []
  };
}

export function validateSingAlongCatalogEligibility(entry: SingAlongCatalogEntry, now = Date.now()) {
  if (entry.eligibilityState !== "playable") {
    return { valid: false, errors: [`candidate lifecycle state is ${entry.eligibilityState ?? "legacy-unclassified"}`] };
  }
  if (!entry.providerResult) return { valid: false, errors: ["provider timing result is required"] };
  const validation = validateSingAlongProviderResult(entry.providerResult, undefined, now);
  const consistencyErrors = [
    normalizeUsedContentText(entry.title) === normalizeUsedContentText(entry.providerResult.songIdentity.title) ? "" : "entry song differs from provider result",
    normalizeUsedContentText(entry.artist) === normalizeUsedContentText(entry.providerResult.artistIdentity.name) ? "" : "entry artist differs from provider result",
    normalizeUsedContentText(entry.answerLyricExcerpt) === normalizeUsedContentText(entry.providerResult.answerCueText || entry.providerResult.answerRepresentation.displayText) ? "" : "entry answer differs from provider result",
    entry.clipStartTimeSeconds === entry.providerResult.lyricCueStartSeconds && entry.clipEndTimeSeconds === entry.providerResult.lyricCueEndSeconds ? "" : "entry clip differs from provider result"
  ].filter(Boolean);
  return { valid: validation.valid && !consistencyErrors.length, errors: [...validation.errors, ...consistencyErrors] };
}

export function isEligibleSingAlongCatalogEntry(entry: SingAlongCatalogEntry, now = Date.now()) {
  return validateSingAlongCatalogEligibility(entry, now).valid;
}

export const SING_ALONG_QUALITY_CONSTANTS = {
  maxVerificationAgeMs: MAX_VERIFICATION_AGE_MS,
  minimumTimingConfidence: MIN_TIMING_CONFIDENCE
} as const;
