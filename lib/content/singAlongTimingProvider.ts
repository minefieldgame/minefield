export type SingAlongUsageClassification =
  | "licensed-preview-and-lyrics"
  | "project-owned"
  | "public-domain"
  | "unverified";

export type SingAlongProviderCapabilities = {
  stableRecordingIdentity: boolean;
  previewPlayback: boolean;
  previewDuration: boolean;
  previewRelativeTiming: boolean;
  synchronizedLyricCues: boolean;
  licensedAnswerRepresentation: boolean;
};

export type SingAlongAnswerRepresentation = {
  kind: "licensed-text" | "project-owned-text" | "public-domain-text" | "provider-token";
  displayText: string;
  acceptedTexts: string[];
  providerToken?: string;
};

export type SingAlongTimingProviderResult = {
  songIdentity: {
    title: string;
    providerSongId: string;
  };
  artistIdentity: {
    name: string;
    providerArtistId: string;
  };
  recordingIdentity: {
    providerRecordingId: string;
    isrc?: string;
    matchedSourceRecordingIds: string[];
    version: "original" | "intended-remaster" | "live" | "cover" | "remix" | "karaoke" | "sped-up" | "slowed" | "other";
  };
  chartIdentity: {
    chartDate: string;
    chartYear: number;
    chartPosition: number;
  };
  previewUrl: string;
  previewDurationSeconds: number;
  lyricCueStartSeconds: number;
  lyricCueEndSeconds: number;
  lyricCueText: string;
  answerCueStartSeconds: number;
  answerCueEndSeconds: number;
  answerCueText?: string;
  answerRepresentation: SingAlongAnswerRepresentation;
  choices: Array<{ id: "a" | "b" | "c" | "d"; text: string; isCorrect: boolean }>;
  timingConfidence: number;
  ambiguityAssessment: "unambiguous" | "ambiguous" | "unknown";
  sourceProvider: string;
  usageClassification: SingAlongUsageClassification;
  licenseReference: string;
  lastVerifiedAt: string;
  capabilities: SingAlongProviderCapabilities;
  verificationClaims: {
    previewLoaded: boolean;
    recordingIdentityMatched: boolean;
    /** Must remain false unless a real audio-semantic verifier is introduced. */
    audioSemanticVerified: false;
  };
};

export type SingAlongTimingLookup = {
  title: string;
  artist: string;
  sourceRecordingId: string;
  sourceProvider: string;
  collectionName?: string;
  previewUrl?: string;
};

export interface SingAlongTimingProvider {
  id: string;
  priority: number;
  capabilities: SingAlongProviderCapabilities;
  isConfigured(): boolean;
  lookup(input: SingAlongTimingLookup, signal: AbortSignal): Promise<SingAlongTimingProviderResult | null>;
}

export type SingAlongProviderResolution = {
  result: SingAlongTimingProviderResult;
  providerId: string;
  providerCalls: number;
  cacheHit: boolean;
  attemptedProviders: string[];
  providerErrors: string[];
};

export type SingAlongProviderHealth = {
  providerId: string;
  configured: boolean;
  consecutiveFailures: number;
  status: "healthy" | "degraded" | "backoff" | "unconfigured";
  backoffUntil?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
};

export const SING_ALONG_PROVIDER_UNAVAILABLE_MARKER = "[sing_along_provider_unavailable]";
export const SING_ALONG_PROVIDER_DATA_PENDING_MARKER = "[sing_along_provider_data_pending]";

export class SingAlongProviderUnavailableError extends Error {
  readonly code = "provider_unavailable";

  constructor(message: string) {
    super(`${SING_ALONG_PROVIDER_UNAVAILABLE_MARKER} ${message}`);
    this.name = "SingAlongProviderUnavailableError";
  }
}

export class SingAlongProviderDataPendingError extends Error {
  readonly code = "pending_provider_data";

  constructor(message: string) {
    super(`${SING_ALONG_PROVIDER_DATA_PENDING_MARKER} ${message}`);
    this.name = "SingAlongProviderDataPendingError";
  }
}

type CachedProviderResult = {
  expiresAt: number;
  value: SingAlongTimingProviderResult | null;
};

type MutableProviderHealth = {
  consecutiveFailures: number;
  backoffUntil: number;
  lastSuccessAt?: string;
  lastFailureAt?: string;
};

const resultCache = new Map<string, CachedProviderResult>();
const healthByProvider = new Map<string, MutableProviderHealth>();
const SUCCESS_CACHE_MS = 24 * 60 * 60 * 1000;
const NEGATIVE_CACHE_MS = 15 * 60 * 1000;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 8_000;

function normalizedIdentity(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, " ").toLowerCase().trim();
}

function cacheKey(provider: SingAlongTimingProvider, input: SingAlongTimingLookup) {
  return [provider.id, input.sourceProvider, input.sourceRecordingId, normalizedIdentity(input.artist), normalizedIdentity(input.title)].join(":");
}

function providerHealth(providerId: string) {
  const current = healthByProvider.get(providerId) ?? { consecutiveFailures: 0, backoffUntil: 0 };
  healthByProvider.set(providerId, current);
  return current;
}

function markSuccess(providerId: string, now: number) {
  const health = providerHealth(providerId);
  health.consecutiveFailures = 0;
  health.backoffUntil = 0;
  health.lastSuccessAt = new Date(now).toISOString();
}

function markFailure(providerId: string, now: number) {
  const health = providerHealth(providerId);
  health.consecutiveFailures += 1;
  health.lastFailureAt = new Date(now).toISOString();
  health.backoffUntil = now + Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.min(health.consecutiveFailures - 1, 8));
}

export function providerHasPublicationCapabilities(capabilities: SingAlongProviderCapabilities) {
  return capabilities.stableRecordingIdentity && capabilities.previewPlayback && capabilities.previewDuration &&
    capabilities.previewRelativeTiming && capabilities.synchronizedLyricCues && capabilities.licensedAnswerRepresentation;
}

function configuredSecret(name: string) {
  const direct = process.env[name]?.trim();
  if (direct) return direct;
  try {
    const secrets = JSON.parse(process.env.secrets ?? "{}") as Record<string, unknown>;
    const value = secrets[name];
    return typeof value === "string" ? value.trim() : "";
  } catch {
    return "";
  }
}

function createExternalProvider(): SingAlongTimingProvider {
  const endpoint = process.env.SING_ALONG_TIMING_PROVIDER_ENDPOINT?.trim() ?? "";
  const apiKey = configuredSecret("SING_ALONG_TIMING_PROVIDER_API_KEY");
  const providerId = process.env.SING_ALONG_TIMING_PROVIDER_ID?.trim() || "external-licensed-timing";
  const capabilities: SingAlongProviderCapabilities = {
    stableRecordingIdentity: true,
    previewPlayback: true,
    previewDuration: true,
    previewRelativeTiming: true,
    synchronizedLyricCues: true,
    licensedAnswerRepresentation: true
  };
  return {
    id: providerId,
    priority: 100,
    capabilities,
    isConfigured: () => Boolean(endpoint && apiKey),
    async lookup(input, signal) {
      if (!endpoint || !apiKey) throw new SingAlongProviderUnavailableError("The external licensed timing endpoint or credential is missing.");
      const parsed = new URL(endpoint);
      if (parsed.protocol !== "https:") throw new SingAlongProviderUnavailableError("The external timing provider endpoint must use HTTPS.");
      const response = await fetch(parsed, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(input),
        cache: "no-store",
        signal
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Licensed timing provider returned ${response.status}.`);
      return await response.json() as SingAlongTimingProviderResult;
    }
  };
}

function createMusixmatchCapabilityProvider(): SingAlongTimingProvider {
  const apiKey = configuredSecret("MUSIXMATCH_API_KEY");
  return {
    id: "musixmatch-richsync-without-preview-alignment",
    priority: 90,
    capabilities: {
      stableRecordingIdentity: true,
      previewPlayback: false,
      previewDuration: false,
      previewRelativeTiming: false,
      synchronizedLyricCues: true,
      licensedAnswerRepresentation: true
    },
    isConfigured: () => Boolean(apiKey),
    async lookup() {
      throw new SingAlongProviderUnavailableError(
        "Musixmatch full-recording synchronization is configured, but no licensed same-recording preview offset provider is configured. Full-track timing is not promoted to preview-relative timing."
      );
    }
  };
}

export function getConfiguredSingAlongTimingProviders() {
  const configuredNames = (process.env.SING_ALONG_TIMING_PROVIDER ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!configuredNames.length) return [];
  return configuredNames.flatMap((name) => {
    if (name === "external") return [createExternalProvider()];
    if (name === "musixmatch") return [createMusixmatchCapabilityProvider()];
    return [];
  });
}

export function getSingAlongProviderHealth(providers = getConfiguredSingAlongTimingProviders(), now = Date.now()): SingAlongProviderHealth[] {
  return providers.map((provider) => {
    const health = providerHealth(provider.id);
    const configured = provider.isConfigured();
    const backoff = health.backoffUntil > now;
    return {
      providerId: provider.id,
      configured,
      consecutiveFailures: health.consecutiveFailures,
      status: !configured ? "unconfigured" : backoff ? "backoff" : health.consecutiveFailures ? "degraded" : "healthy",
      ...(backoff ? { backoffUntil: new Date(health.backoffUntil).toISOString() } : {}),
      ...(health.lastSuccessAt ? { lastSuccessAt: health.lastSuccessAt } : {}),
      ...(health.lastFailureAt ? { lastFailureAt: health.lastFailureAt } : {})
    };
  });
}

export async function resolveSingAlongTiming({
  input,
  providers = getConfiguredSingAlongTimingProviders(),
  now = Date.now(),
  timeoutMs = DEFAULT_TIMEOUT_MS
}: {
  input: SingAlongTimingLookup;
  providers?: SingAlongTimingProvider[];
  now?: number;
  timeoutMs?: number;
}): Promise<SingAlongProviderResolution> {
  const ordered = [...providers].sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
  if (!ordered.length) {
    throw new SingAlongProviderUnavailableError(
      "No licensed preview-relative timing provider is configured. Set SING_ALONG_TIMING_PROVIDER=external together with SING_ALONG_TIMING_PROVIDER_ENDPOINT and SING_ALONG_TIMING_PROVIDER_API_KEY."
    );
  }

  const attemptedProviders: string[] = [];
  const providerErrors: string[] = [];
  let providerCalls = 0;
  let configuredProviderSeen = false;
  let responsiveProviderSeen = false;

  for (const provider of ordered) {
    if (!provider.isConfigured()) {
      providerErrors.push(`${provider.id}: credential or endpoint missing`);
      continue;
    }
    configuredProviderSeen = true;
    if (!providerHasPublicationCapabilities(provider.capabilities)) {
      providerErrors.push(`${provider.id}: provider lacks required publication capabilities`);
      continue;
    }
    attemptedProviders.push(provider.id);
    const key = cacheKey(provider, input);
    const cached = resultCache.get(key);
    if (cached && cached.expiresAt > now) {
      if (cached.value) {
        return { result: cached.value, providerId: provider.id, providerCalls, cacheHit: true, attemptedProviders, providerErrors };
      }
      responsiveProviderSeen = true;
      continue;
    }

    const health = providerHealth(provider.id);
    if (health.backoffUntil > now) {
      providerErrors.push(`${provider.id}: in retry backoff`);
      continue;
    }

    providerCalls += 1;
    try {
      const result = await provider.lookup(input, AbortSignal.timeout(timeoutMs));
      responsiveProviderSeen = true;
      markSuccess(provider.id, now);
      resultCache.set(key, { value: result, expiresAt: now + (result ? SUCCESS_CACHE_MS : NEGATIVE_CACHE_MS) });
      if (result) return { result, providerId: provider.id, providerCalls, cacheHit: false, attemptedProviders, providerErrors };
    } catch (error) {
      markFailure(provider.id, now);
      providerErrors.push(`${provider.id}: ${error instanceof Error ? error.message : "provider request failed"}`);
    }
  }

  if (responsiveProviderSeen) {
    throw new SingAlongProviderDataPendingError(`No configured provider returned timing for ${input.title} by ${input.artist}.`);
  }
  throw new SingAlongProviderUnavailableError(
    configuredProviderSeen
      ? `Every configured provider is unavailable or in backoff. ${providerErrors.join(" | ")}`
      : `No configured provider has usable credentials. ${providerErrors.join(" | ")}`
  );
}

export async function verifySingAlongPreviewUrl(
  previewUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS
) {
  const url = new URL(previewUrl);
  if (url.protocol !== "https:") return { valid: false, status: 0, contentType: "", reason: "preview URL must use HTTPS" };
  const request = async (method: "HEAD" | "GET") => fetchImpl(url, {
    method,
    headers: method === "GET" ? { Range: "bytes=0-0" } : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs)
  });
  try {
    let response = await request("HEAD");
    if (!response.ok || response.status === 405) response = await request("GET");
    const contentType = response.headers.get("content-type") ?? "";
    const mediaTypeValid = !contentType || /^(audio\/|application\/(?:octet-stream|vnd\.apple\.mpegurl))/i.test(contentType);
    await response.body?.cancel().catch(() => undefined);
    return {
      valid: response.ok && mediaTypeValid,
      status: response.status,
      contentType,
      reason: !response.ok ? `preview returned ${response.status}` : mediaTypeValid ? "" : `unexpected preview content type ${contentType}`
    };
  } catch (error) {
    return { valid: false, status: 0, contentType: "", reason: error instanceof Error ? error.message : "preview request failed" };
  }
}

export function classifySingAlongProviderFailure(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason ?? "");
  if (reason instanceof SingAlongProviderUnavailableError || message.includes(SING_ALONG_PROVIDER_UNAVAILABLE_MARKER)) {
    return { errorType: "provider_unavailable" as const, retryable: true };
  }
  if (reason instanceof SingAlongProviderDataPendingError || message.includes(SING_ALONG_PROVIDER_DATA_PENDING_MARKER) || /exhausted|no eligible/i.test(message)) {
    return { errorType: "eligible_inventory_exhausted" as const, retryable: false };
  }
  if (/DynamoDB|table|transaction|credential provider/i.test(message)) {
    return { errorType: "infrastructure_failure" as const, retryable: true };
  }
  return { errorType: "quality_gate_failure" as const, retryable: false };
}

export function resetSingAlongProviderRuntimeStateForTests() {
  resultCache.clear();
  healthByProvider.clear();
}
