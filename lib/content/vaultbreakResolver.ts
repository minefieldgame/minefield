import "server-only";

import {
  generateVaultbreakPuzzle,
  VAULTBREAK_PROCEDURAL_HEALTH_BASELINE,
  vaultbreakCluePatternKey,
  vaultbreakExactPuzzleKey,
  vaultbreakNormalizedClueSetKey,
  vaultbreakSecretCooldownKey
} from "@/games/vaultbreak/logic";
import type { VaultbreakEliminationStep, VaultbreakPuzzle } from "@/games/vaultbreak/types";
import {
  CandidatePoolExhaustedError,
  getPersistedPuzzle,
  getUsedContentKeyDates,
  publishDailyPuzzleWithUsedContent,
  retryCandidateCollisions
} from "@/lib/content/persistence";
import { createUsedContentRecord } from "@/lib/content/usedContentRegistry";
import { getGameCacheKey } from "@/lib/date";
import { buildCooldownWindowKeys, datedCooldownKey } from "@/lib/content/publishSemantics";

const GAME_ID = "vaultbreak";
const MAX_EXACT_COLLISION_ATTEMPTS = 8;
const MAX_COOLDOWN_CANDIDATES_PER_ATTEMPT = 16;
export const VAULTBREAK_SECRET_COOLDOWN_DAYS = 30;
export const VAULTBREAK_PATTERN_COOLDOWN_DAYS = 7;

export type VaultbreakResolverDiagnostics = {
  selectedDate: string;
  cacheKey: string;
  status: "Cached" | "Generated";
  contentHash: string;
  difficulty: VaultbreakPuzzle["difficulty"];
  secretCode: string;
  clueCount: number;
  initialCandidateCount: number;
  remainingCandidatesAfterEachClue: VaultbreakEliminationStep[];
  finalSolutionCount: number;
  estimatedDifficultyScore: number;
  generatorSeed: string;
  generationAttempts: number;
  exactDuplicateStatus: "available";
  cooldownStatus: "clear" | "pattern-relaxed";
  exactCollisionRetries: number;
  cooldownCollisions: number;
  secretCodeCooldownDays: number;
  cluePatternCooldownDays: number;
  dynamoDbReads: number;
  dynamoDbKeysRead: number;
  dynamoDbWrites: number;
  generationDurationMs: number;
  proceduralBaseline: typeof VAULTBREAK_PROCEDURAL_HEALTH_BASELINE;
};

export type ResolvedVaultbreakPuzzle = VaultbreakPuzzle & {
  cacheHit: boolean;
  uniqueContentKey: string;
  duplicateCheck: {
    passed: boolean;
    duplicateDetected: boolean;
    retryCount: number;
    checkedAgainstCount: number;
  };
  resolverDiagnostics: VaultbreakResolverDiagnostics;
};

function cachedPuzzle(puzzle: ResolvedVaultbreakPuzzle): ResolvedVaultbreakPuzzle {
  return {
    ...puzzle,
    cacheHit: true,
    resolverDiagnostics: {
      ...puzzle.resolverDiagnostics,
      status: "Cached",
      dynamoDbWrites: 0
    }
  };
}

function resolvedPuzzle({
  puzzle,
  date,
  startedAt,
  exactCollisionRetries,
  cooldownCollisions,
  cooldownStatus,
  dynamoDbReads,
  dynamoDbKeysRead
}: {
  puzzle: VaultbreakPuzzle;
  date: string;
  startedAt: number;
  exactCollisionRetries: number;
  cooldownCollisions: number;
  cooldownStatus: VaultbreakResolverDiagnostics["cooldownStatus"];
  dynamoDbReads: number;
  dynamoDbKeysRead: number;
}): ResolvedVaultbreakPuzzle {
  const exactKey = vaultbreakExactPuzzleKey(puzzle.secretCode, puzzle.clues);
  return {
    ...puzzle,
    cacheHit: false,
    uniqueContentKey: exactKey,
    duplicateCheck: {
      passed: true,
      duplicateDetected: false,
      retryCount: exactCollisionRetries,
      checkedAgainstCount: dynamoDbKeysRead
    },
    resolverDiagnostics: {
      selectedDate: date,
      cacheKey: getGameCacheKey(GAME_ID, date),
      status: "Generated",
      contentHash: puzzle.contentHash,
      difficulty: puzzle.difficulty,
      secretCode: puzzle.secretCode,
      clueCount: puzzle.clues.length,
      initialCandidateCount: puzzle.diagnostics.initialCandidateCount,
      remainingCandidatesAfterEachClue: puzzle.diagnostics.remainingCandidatesAfterEachClue,
      finalSolutionCount: puzzle.diagnostics.finalSolutionCount,
      estimatedDifficultyScore: puzzle.diagnostics.difficultyScore,
      generatorSeed: puzzle.diagnostics.seed,
      generationAttempts: puzzle.diagnostics.generationAttempts,
      exactDuplicateStatus: "available",
      cooldownStatus,
      exactCollisionRetries,
      cooldownCollisions,
      secretCodeCooldownDays: VAULTBREAK_SECRET_COOLDOWN_DAYS,
      cluePatternCooldownDays: VAULTBREAK_PATTERN_COOLDOWN_DAYS,
      dynamoDbReads,
      dynamoDbKeysRead,
      dynamoDbWrites: 1,
      generationDurationMs: Date.now() - startedAt,
      proceduralBaseline: VAULTBREAK_PROCEDURAL_HEALTH_BASELINE
    }
  };
}

export async function resolveVaultbreakForDate(date: string): Promise<ResolvedVaultbreakPuzzle> {
  const startedAt = Date.now();
  const authoritative = await getPersistedPuzzle<ResolvedVaultbreakPuzzle>(GAME_ID, date);
  if (authoritative) return cachedPuzzle(authoritative);

  let dynamoDbReads = 1;
  let dynamoDbKeysRead = 0;
  return retryCandidateCollisions({
    gameId: GAME_ID,
    dateKey: date,
    maxAttempts: MAX_EXACT_COLLISION_ATTEMPTS,
    operation: async (exactCollisionAttempt) => {
      const winner = await getPersistedPuzzle<ResolvedVaultbreakPuzzle>(GAME_ID, date);
      dynamoDbReads += 1;
      if (winner) return cachedPuzzle(winner);

      let cooldownCollisions = 0;
      let selected: VaultbreakPuzzle | null = null;
      let selectedReservationChecks: string[] = [];
      let patternRelaxationCandidate: { puzzle: VaultbreakPuzzle; reservationChecks: string[] } | null = null;
      for (let offset = 0; offset < MAX_COOLDOWN_CANDIDATES_PER_ATTEMPT; offset += 1) {
        const retryOffset = exactCollisionAttempt * MAX_COOLDOWN_CANDIDATES_PER_ATTEMPT + offset;
        const candidate = generateVaultbreakPuzzle(date, undefined, retryOffset);
        const secretBaseKey = vaultbreakSecretCooldownKey(candidate.secretCode);
        const patternBaseKey = vaultbreakCluePatternKey(candidate.clues);
        const secretWindowKeys = buildCooldownWindowKeys(secretBaseKey, date, VAULTBREAK_SECRET_COOLDOWN_DAYS);
        const patternWindowKeys = buildCooldownWindowKeys(patternBaseKey, date, VAULTBREAK_PATTERN_COOLDOWN_DAYS);
        const cooldownKeys = [...secretWindowKeys, ...patternWindowKeys];
        const usedDates = await getUsedContentKeyDates(cooldownKeys);
        dynamoDbReads += 1;
        dynamoDbKeysRead += cooldownKeys.length;
        const secretBlocked = secretWindowKeys.some((key) => usedDates.has(key));
        const patternBlocked = patternWindowKeys.some((key) => usedDates.has(key));
        const ownSecretKey = datedCooldownKey(secretBaseKey, date);
        const ownPatternKey = datedCooldownKey(patternBaseKey, date);
        const secretReservationChecks = secretWindowKeys.filter((key) => key !== ownSecretKey);
        const patternReservationChecks = patternWindowKeys.filter((key) => key !== ownPatternKey);
        if (secretBlocked || patternBlocked) {
          cooldownCollisions += 1;
          if (!secretBlocked && patternBlocked && !patternRelaxationCandidate) {
            patternRelaxationCandidate = { puzzle: candidate, reservationChecks: secretReservationChecks };
          }
          continue;
        }
        selected = candidate;
        selectedReservationChecks = [...secretReservationChecks, ...patternReservationChecks];
        break;
      }
      const cooldownStatus: VaultbreakResolverDiagnostics["cooldownStatus"] = selected ? "clear" : "pattern-relaxed";
      if (!selected && patternRelaxationCandidate) {
        selected = patternRelaxationCandidate.puzzle;
        selectedReservationChecks = patternRelaxationCandidate.reservationChecks;
      }
      if (!selected) throw new CandidatePoolExhaustedError(GAME_ID, date, MAX_COOLDOWN_CANDIDATES_PER_ATTEMPT);

      const puzzle = resolvedPuzzle({
        puzzle: selected,
        date,
        startedAt,
        exactCollisionRetries: exactCollisionAttempt,
        cooldownCollisions,
        cooldownStatus,
        dynamoDbReads,
        dynamoDbKeysRead
      });
      const sourceMetadata = {
        source: "deterministic-local-vaultbreak-solver",
        validationVersion: "vaultbreak-v1",
        difficulty: puzzle.difficulty,
        clueCount: puzzle.clues.length,
        finalSolutionCount: puzzle.diagnostics.finalSolutionCount,
        difficultyScore: puzzle.diagnostics.difficultyScore,
        generatorSeed: puzzle.seed
      };
      const published = await publishDailyPuzzleWithUsedContent({
        gameId: GAME_ID,
        dateKey: date,
        puzzle,
        contentHash: puzzle.contentHash,
        conditionalAbsentUsedContentKeys: selectedReservationChecks,
        usedContentRecords: [
          createUsedContentRecord({
            gameId: GAME_ID,
            date,
            contentType: "vaultbreak-exact-puzzle",
            prompt: puzzle.clues.map((clue) => clue.text).join(" | "),
            answer: puzzle.secretCode,
            uniqueContentKey: puzzle.duplicateKeys.exactPuzzleKey,
            sourceMetadata
          }),
          createUsedContentRecord({
            gameId: GAME_ID,
            date,
            contentType: "vaultbreak-normalized-clue-set",
            prompt: puzzle.clues.map((clue) => clue.text).join(" | "),
            answer: puzzle.secretCode,
            uniqueContentKey: vaultbreakNormalizedClueSetKey(puzzle.clues),
            sourceMetadata
          }),
          createUsedContentRecord({
            gameId: GAME_ID,
            date,
            contentType: "vaultbreak-secret-cooldown",
            prompt: puzzle.prompt,
            answer: puzzle.secretCode,
            uniqueContentKey: datedCooldownKey(vaultbreakSecretCooldownKey(puzzle.secretCode), date),
            reservationMode: "cooldown",
            sourceMetadata: { ...sourceMetadata, cooldownDays: VAULTBREAK_SECRET_COOLDOWN_DAYS }
          }),
          createUsedContentRecord({
            gameId: GAME_ID,
            date,
            contentType: "vaultbreak-pattern-cooldown",
            prompt: puzzle.clues.map((clue) => clue.type).join(" | "),
            answer: puzzle.secretCode,
            uniqueContentKey: datedCooldownKey(vaultbreakCluePatternKey(puzzle.clues), date),
            reservationMode: "cooldown",
            sourceMetadata: { ...sourceMetadata, cooldownDays: VAULTBREAK_PATTERN_COOLDOWN_DAYS }
          })
        ]
      });
      return published.created ? published.puzzle : cachedPuzzle(published.puzzle);
    }
  });
}
