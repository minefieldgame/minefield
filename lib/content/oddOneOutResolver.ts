import "server-only";

import type { OddOneOutCandidate, OddOneOutPuzzle } from "@/games/odd-one-out/types";
import { getGameCacheKey } from "@/lib/date";
import { contentHashFromKey, createUsedContentRecord } from "@/lib/content/usedContentRegistry";
import { selectFromContentUniverse } from "@/lib/content/contentUniverse";
import {
  CandidatePoolExhaustedError,
  getPersistedPuzzle,
  publishDailyPuzzleWithUsedContent,
  retryCandidateCollisions
} from "@/lib/content/persistence";
import {
  ODD_ONE_OUT_CANDIDATES,
  ODD_ONE_OUT_COOLDOWN_DAYS,
  ODD_ONE_OUT_INVENTORY,
  selectOddOneOutCandidateForDate,
  validateOddOneOutCandidate
} from "@/lib/content/oddOneOutInventory";

const GAME_ID = "odd-one-out";
const MAX_CANDIDATE_COLLISION_ATTEMPTS = 6;

function cachedPuzzle(puzzle: OddOneOutPuzzle): OddOneOutPuzzle {
  return {
    ...puzzle,
    cacheHit: true,
    ...(puzzle.diagnostics ? {
      diagnostics: {
        ...puzzle.diagnostics,
        status: "Cached" as const,
        dynamoDbWrites: 0
      }
    } : {})
  };
}

function buildPuzzle({
  candidate,
  date,
  collisionRetries,
  startedAt,
  diagnostics,
  accumulatedDynamoDbReads
}: {
  candidate: OddOneOutCandidate;
  date: string;
  collisionRetries: number;
  startedAt: number;
  diagnostics: Awaited<ReturnType<typeof selectFromContentUniverse<OddOneOutCandidate>>>["diagnostics"];
  accumulatedDynamoDbReads: number;
}): OddOneOutPuzzle {
  const validation = validateOddOneOutCandidate(candidate);
  if (!validation.valid) throw new Error(`Odd One Out validation failure: ${validation.errors.join("; ")}`);
  const contentHash = contentHashFromKey(candidate.exactDuplicateKey);
  return {
    gameId: GAME_ID,
    id: `${GAME_ID}:${date}`,
    candidateId: candidate.id,
    date,
    prompt: candidate.prompt,
    items: [...candidate.items],
    answer: candidate.answer,
    explanation: candidate.explanation,
    sharedProperty: candidate.sharedProperty,
    oddReason: candidate.oddReason,
    category: candidate.category,
    difficulty: candidate.difficulty,
    qualityScore: candidate.qualityScore,
    recognizabilityScore: candidate.recognizabilityScore,
    sourceNote: candidate.sourceNote,
    sourceStrategy: candidate.sourceStrategy,
    contentHash,
    exactDuplicateKey: candidate.exactDuplicateKey,
    semanticTopicKey: candidate.semanticTopicKey,
    answerKey: candidate.answerKey,
    uniqueContentKey: candidate.exactDuplicateKey,
    duplicateCheck: {
      passed: true,
      duplicateDetected: false,
      retryCount: collisionRetries,
      checkedAgainstCount: diagnostics.dynamoDbKeysRead
    },
    validationVersion: candidate.validationVersion,
    generatedAt: `${date}T12:00:00.000Z`,
    cacheHit: false,
    validation,
    diagnostics: {
      selectedDate: date,
      cacheKey: getGameCacheKey(GAME_ID, date),
      status: "Generated",
      contentHash,
      categoryFamily: candidate.category,
      difficulty: candidate.difficulty,
      qualityScore: candidate.qualityScore,
      recognizabilityScore: candidate.recognizabilityScore,
      exactDuplicateStatus: "available",
      cooldownStatus: diagnostics.relaxationRulesUsed.length ? "relaxed" : "clear",
      inventoryTotal: ODD_ONE_OUT_CANDIDATES.length,
      eligibleInventory: ODD_ONE_OUT_INVENTORY.eligibleCount,
      unusedEligibleInventory: Math.min(ODD_ONE_OUT_INVENTORY.eligibleCount, diagnostics.remainingCandidates),
      rejectedCandidates: ODD_ONE_OUT_INVENTORY.rejectedCount + diagnostics.excludedInvalid,
      selectedCandidateId: candidate.id,
      sourceGenerationStrategy: candidate.sourceStrategy,
      sourceStrategy: candidate.sourceStrategy,
      dynamoDbReads: accumulatedDynamoDbReads,
      dynamoDbKeysRead: diagnostics.dynamoDbKeysRead,
      dynamoDbWrites: 1,
      candidateCollisionRetries: collisionRetries,
      generationDurationMs: Date.now() - startedAt
    }
  };
}

export async function resolveOddOneOutForDate(
  date: string,
  options: { retryOffset?: number } = {}
): Promise<OddOneOutPuzzle> {
  const startedAt = Date.now();
  const authoritative = await getPersistedPuzzle<OddOneOutPuzzle>(GAME_ID, date);
  if (authoritative) return cachedPuzzle(authoritative);

  let accumulatedDynamoDbReads = 1;
  return retryCandidateCollisions({
    gameId: GAME_ID,
    dateKey: date,
    maxAttempts: MAX_CANDIDATE_COLLISION_ATTEMPTS,
    operation: async (attempt) => {
      // A prior collision or concurrent request may have published while this
      // resolver was choosing another candidate.
      const winner = await getPersistedPuzzle<OddOneOutPuzzle>(GAME_ID, date);
      accumulatedDynamoDbReads += 1;
      if (winner) return cachedPuzzle(winner);

      const retryOffset = (options.retryOffset ?? 0) + attempt;
      const selection = await selectFromContentUniverse({
        gameSeed: `${date}:odd-one-out:${retryOffset}`,
        contentSource: "project-authored-source-backed-template-inventory",
        softCooldownLabel: "recent Odd One Out topic/answer cooldown",
        dateKey: date,
        cooldownDays: ODD_ONE_OUT_COOLDOWN_DAYS,
        batchSizes: [250, 600, ODD_ONE_OUT_INVENTORY.eligibleCount],
        universe: {
          getAllCandidates: () => ODD_ONE_OUT_INVENTORY.eligibleCandidates,
          getCandidateId: (candidate) => candidate.id,
          getHardKeys: (candidate) => [...new Set(candidate.duplicateKeys)],
          getSoftKeys: (candidate) => [...new Set([candidate.semanticTopicKey, candidate.answerKey])],
          validateCandidate: (candidate) => {
            const validation = validateOddOneOutCandidate(candidate);
            return { valid: validation.valid, reason: validation.errors.join("; ") || "Source-backed template validation" };
          },
          selectCandidate: (candidates) =>
            selectOddOneOutCandidateForDate(date, candidates, { retryOffset }).candidate
        }
      });
      accumulatedDynamoDbReads += selection.diagnostics.dynamoDbReadCount;
      if (!selection.selected) throw new CandidatePoolExhaustedError(GAME_ID, date, attempt + 1);

      const puzzle = buildPuzzle({
        candidate: selection.selected,
        date,
        collisionRetries: attempt,
        startedAt,
        diagnostics: selection.diagnostics,
        accumulatedDynamoDbReads
      });
      const sourceMetadata = {
        source: "project-authored-source-backed-template-inventory",
        sourceNote: selection.selected.sourceNote,
        sourceStrategy: selection.selected.sourceStrategy,
        candidateId: selection.selected.id,
        category: selection.selected.category,
        difficulty: selection.selected.difficulty,
        qualityScore: selection.selected.qualityScore,
        recognizabilityScore: selection.selected.recognizabilityScore,
        validationVersion: selection.selected.validationVersion,
        cooldownDays: ODD_ONE_OUT_COOLDOWN_DAYS
      };
      const published = await publishDailyPuzzleWithUsedContent({
        gameId: GAME_ID,
        dateKey: date,
        puzzle,
        contentHash: puzzle.contentHash,
        usedContentRecords: [
          createUsedContentRecord({
            gameId: GAME_ID,
            date,
            contentType: "odd-one-out-item-set",
            prompt: selection.selected.prompt,
            answer: selection.selected.answer,
            uniqueContentKey: selection.selected.exactDuplicateKey,
            sourceMetadata
          }),
          createUsedContentRecord({
            gameId: GAME_ID,
            date,
            contentType: "odd-one-out-topic-cooldown",
            prompt: selection.selected.sharedProperty,
            answer: selection.selected.answer,
            uniqueContentKey: selection.selected.semanticTopicKey,
            reservationMode: "cooldown",
            sourceMetadata: { ...sourceMetadata, cooldown: true }
          }),
          createUsedContentRecord({
            gameId: GAME_ID,
            date,
            contentType: "odd-one-out-answer-cooldown",
            prompt: selection.selected.prompt,
            answer: selection.selected.answer,
            uniqueContentKey: selection.selected.answerKey,
            reservationMode: "cooldown",
            sourceMetadata: { ...sourceMetadata, cooldown: true }
          })
        ]
      });
      return published.created ? published.puzzle : cachedPuzzle(published.puzzle);
    }
  });
}
