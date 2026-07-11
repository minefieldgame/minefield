import "server-only";

import { checkUsedContentKeys } from "@/lib/content/persistence";
import { createSeededRandom } from "@/lib/dailySeed";

export type ExhaustionLevel = "healthy" | "low" | "critical" | "exhausted";
export type HealthStatus = "Healthy" | "Limited" | "Critical" | "Exhausted" | "Provider Failure";

export type ContentUniverseDiagnostics = {
  contentSource: string;
  totalCandidates: number;
  validatedCandidateCount: number;
  excludedPreviouslyUsed: number;
  excludedInvalid: number;
  excludedSoftCooldown: number;
  remainingCandidates: number;
  selectedCandidateId?: string;
  selectionStage: number;
  relaxationRulesUsed: string[];
  duplicateCheckQueries: number;
  dynamoDbReadCount: number;
  sequentialRetries: number;
  retryCount: number;
  exhaustionLevel: ExhaustionLevel;
  healthStatus: HealthStatus;
  warnings: string[];
};

export type ValidationResult = { valid: boolean; reason?: string };

export interface ContentUniverse<T> {
  getAllCandidates(): Promise<readonly T[]> | readonly T[];
  getCandidateId(candidate: T): string;
  getHardKeys(candidate: T): string[];
  getSoftKeys?: (candidate: T) => string[];
  validateCandidate(candidate: T): ValidationResult;
  selectCandidate(candidates: readonly T[], gameSeed: string): T | null;
}

function health(remaining: number, total: number): { exhaustionLevel: ExhaustionLevel; healthStatus: HealthStatus } {
  if (remaining <= 0) return { exhaustionLevel: "exhausted", healthStatus: "Exhausted" };
  const ratio = total ? remaining / total : 0;
  if (ratio < 0.03) return { exhaustionLevel: "critical", healthStatus: "Critical" };
  if (ratio < 0.12) return { exhaustionLevel: "low", healthStatus: "Limited" };
  return { exhaustionLevel: "healthy", healthStatus: "Healthy" };
}

export async function selectFromContentUniverse<T>({
  universe,
  gameSeed,
  contentSource,
  softCooldownLabel = "soft cooldown"
}: {
  universe: ContentUniverse<T>;
  gameSeed: string;
  contentSource: string;
  softCooldownLabel?: string;
}) {
  const startedAt = Date.now();
  const allCandidates = await universe.getAllCandidates();
  const validCandidates: T[] = [];
  let excludedInvalid = 0;

  for (const candidate of allCandidates) {
    const validation = universe.validateCandidate(candidate);
    if (validation.valid) validCandidates.push(candidate);
    else excludedInvalid += 1;
  }

  const hardKeysByCandidate = new Map<T, string[]>();
  const hardKeys = validCandidates.flatMap((candidate) => {
    const keys = [...new Set(universe.getHardKeys(candidate).filter(Boolean))];
    hardKeysByCandidate.set(candidate, keys);
    return keys;
  });
  const usedHardKeys = new Set(await checkUsedContentKeys(hardKeys));
  const hardFiltered = validCandidates.filter((candidate) =>
    !(hardKeysByCandidate.get(candidate) ?? []).some((key) => usedHardKeys.has(key))
  );

  const softKeysByCandidate = new Map<T, string[]>();
  const softKeys = hardFiltered.flatMap((candidate) => {
    const keys = [...new Set((universe.getSoftKeys?.(candidate) ?? []).filter(Boolean))];
    softKeysByCandidate.set(candidate, keys);
    return keys;
  });
  const usedSoftKeys = softKeys.length ? new Set(await checkUsedContentKeys(softKeys)) : new Set<string>();
  const softFiltered = hardFiltered.filter((candidate) =>
    !(softKeysByCandidate.get(candidate) ?? []).some((key) => usedSoftKeys.has(key))
  );

  const strictPool = softFiltered;
  const relaxedPool = hardFiltered;
  const selectedPool = strictPool.length ? strictPool : relaxedPool;
  const selected = universe.selectCandidate(selectedPool, gameSeed);
  const relaxed = !strictPool.length && relaxedPool.length > 0;
  const state = health(selectedPool.length, Math.max(1, validCandidates.length));
  const diagnostics: ContentUniverseDiagnostics & { generationDurationMs: number } = {
    contentSource,
    totalCandidates: allCandidates.length,
    validatedCandidateCount: validCandidates.length,
    excludedPreviouslyUsed: validCandidates.length - hardFiltered.length,
    excludedInvalid,
    excludedSoftCooldown: hardFiltered.length - softFiltered.length,
    remainingCandidates: selectedPool.length,
    selectedCandidateId: selected ? universe.getCandidateId(selected) : undefined,
    selectionStage: relaxed ? 1 : 0,
    relaxationRulesUsed: relaxed ? [softCooldownLabel] : [],
    duplicateCheckQueries: (hardKeys.length ? 1 : 0) + (softKeys.length ? 1 : 0),
    dynamoDbReadCount: hardKeys.length + softKeys.length,
    sequentialRetries: 0,
    retryCount: 0,
    ...state,
    warnings: [
      ...(relaxed ? [`Relaxed ${softCooldownLabel}; exact duplicate blocks remained active.`] : []),
      ...(selected ? [] : ["No valid non-duplicate candidates remain."])
    ],
    generationDurationMs: Date.now() - startedAt
  };
  return { selected, diagnostics, hardKeys: selected ? hardKeysByCandidate.get(selected) ?? [] : [] };
}

export function seededUniverseSelector<T>(
  getId: (candidate: T) => string,
  seedSalt = ""
) {
  return (candidates: readonly T[], gameSeed: string) => {
    if (!candidates.length) return null;
    const ordered = [...candidates].sort((a, b) => getId(a).localeCompare(getId(b)));
    return createSeededRandom(`${gameSeed}:${seedSalt}`).choice(ordered);
  };
}
