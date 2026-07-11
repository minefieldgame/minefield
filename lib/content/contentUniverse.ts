import "server-only";

import { checkUsedContentKeys, getUsedContentKeyDates } from "@/lib/content/persistence";
import { createSeededRandom } from "@/lib/dailySeed";

export type ExhaustionLevel = "healthy" | "low" | "critical" | "exhausted";
export type HealthStatus = "Healthy" | "Low inventory" | "Critically low" | "Exhausted" | "Provider unavailable" | "Validation failure" | "Infrastructure failure";

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
  cooldownDays: number;
  candidateBatches: number[];
  apiCalls: number;
  dynamoDbWrites: number;
  candidatesGeneratedCurrentRequest: number;
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
  if (ratio < 0.03) return { exhaustionLevel: "critical", healthStatus: "Critically low" };
  if (ratio < 0.12) return { exhaustionLevel: "low", healthStatus: "Low inventory" };
  return { exhaustionLevel: "healthy", healthStatus: "Healthy" };
}

export async function selectFromContentUniverse<T>({
  universe,
  gameSeed,
  contentSource,
  softCooldownLabel = "soft cooldown",
  dateKey,
  cooldownDays = 30,
  batchSizes = [200, 500, 2000]
}: {
  universe: ContentUniverse<T>;
  gameSeed: string;
  contentSource: string;
  softCooldownLabel?: string;
  dateKey?: string;
  cooldownDays?: number;
  batchSizes?: number[];
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

  const orderedCandidates = createSeededRandom(`${gameSeed}:candidate-batches`).shuffle(validCandidates);
  const stages = [...new Set([...batchSizes, validCandidates.length])]
    .map((size) => Math.min(validCandidates.length, Math.max(1, size)))
    .filter((size, index, values) => index === 0 || size > values[index - 1]);
  const hardKeysByCandidate = new Map<T, string[]>();
  const softKeysByCandidate = new Map<T, string[]>();
  let selected: T | null = null;
  let selectedPool: T[] = [];
  let hardFiltered: T[] = [];
  let softFiltered: T[] = [];
  let usedHardKeys = new Set<string>();
  let usedSoftKeys = new Set<string>();
  let hardKeys: string[] = [];
  let softKeys: string[] = [];
  let selectionStage = 0;
  let relaxed = false;

  for (let stage = 0; stage < stages.length; stage += 1) {
    selectionStage = stage;
    const candidates = orderedCandidates.slice(0, stages[stage]);
    hardKeys = candidates.flatMap((candidate) => {
      const keys = [...new Set(universe.getHardKeys(candidate).filter(Boolean))];
      hardKeysByCandidate.set(candidate, keys);
      return keys;
    });
    usedHardKeys = new Set(await checkUsedContentKeys(hardKeys));
    hardFiltered = candidates.filter((candidate) =>
      !(hardKeysByCandidate.get(candidate) ?? []).some((key) => usedHardKeys.has(key))
    );
    if (!hardFiltered.length) continue;

    softKeys = hardFiltered.flatMap((candidate) => {
      const keys = [...new Set((universe.getSoftKeys?.(candidate) ?? []).filter(Boolean))];
      softKeysByCandidate.set(candidate, keys);
      return keys;
    });
    const usedDates = softKeys.length ? await getUsedContentKeyDates(softKeys) : new Map<string, string>();
    const cutoff = dateKey ? Date.parse(`${dateKey}T12:00:00Z`) - cooldownDays * 86_400_000 : Number.POSITIVE_INFINITY;
    usedSoftKeys = new Set([...usedDates].filter(([, usedDate]) => Date.parse(`${usedDate}T12:00:00Z`) >= cutoff).map(([key]) => key));
    softFiltered = hardFiltered.filter((candidate) =>
      !(softKeysByCandidate.get(candidate) ?? []).some((key) => usedSoftKeys.has(key))
    );
    selectedPool = softFiltered.length ? softFiltered : hardFiltered;
    relaxed = !softFiltered.length && hardFiltered.length > 0;
    selected = universe.selectCandidate(selectedPool, `${gameSeed}:stage-${stage}`);
    if (selected) break;
  }
  const consideredCount = stages[selectionStage] ?? 0;
  const excludedPreviouslyUsed = Math.max(0, consideredCount - hardFiltered.length);
  const estimatedRemaining = Math.max(selectedPool.length, validCandidates.length - excludedPreviouslyUsed);
  const state = health(estimatedRemaining, Math.max(1, validCandidates.length));
  const diagnostics: ContentUniverseDiagnostics & { generationDurationMs: number } = {
    contentSource,
    totalCandidates: allCandidates.length,
    validatedCandidateCount: validCandidates.length,
    excludedPreviouslyUsed,
    excludedInvalid,
    excludedSoftCooldown: hardFiltered.length - softFiltered.length,
    remainingCandidates: estimatedRemaining,
    selectedCandidateId: selected ? universe.getCandidateId(selected) : undefined,
    selectionStage,
    relaxationRulesUsed: relaxed ? [softCooldownLabel] : [],
    duplicateCheckQueries: (hardKeys.length ? Math.ceil(hardKeys.length / 100) : 0) + (softKeys.length ? Math.ceil(softKeys.length / 100) : 0),
    dynamoDbReadCount: hardKeys.length + softKeys.length,
    sequentialRetries: 0,
    retryCount: 0,
    cooldownDays,
    candidateBatches: stages.slice(0, selectionStage + 1),
    apiCalls: 0,
    dynamoDbWrites: 0,
    candidatesGeneratedCurrentRequest: 0,
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
