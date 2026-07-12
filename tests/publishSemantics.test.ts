import assert from "node:assert/strict";
import test from "node:test";
import {
  CandidateContentCollisionError,
  CandidatePoolExhaustedError,
  dedupeItemKeys,
  dedupeKeyedItems,
  dedupeUsedContentRecords,
  retryCandidateCollisions,
  usedContentReservationCondition
} from "../lib/content/publishSemantics";
import { createUsedContentRecord } from "../lib/content/usedContentRegistry";

function record(key: string, reservationMode: "permanent" | "cooldown") {
  return createUsedContentRecord({
    gameId: "test",
    date: "2026-12-12",
    contentType: "fixture",
    prompt: "Fixture prompt",
    answer: "Fixture answer",
    uniqueContentKey: key,
    reservationMode
  });
}

test("DynamoDB item keys are deduplicated before batch and transaction construction", () => {
  assert.deepEqual(dedupeItemKeys(["a", "a", "", " b ", "b", "c"]), ["a", "b", "c"]);
  const deduped = dedupeUsedContentRecords([
    record("exact:a", "permanent"),
    record("exact:a", "permanent"),
    record("topic:a", "cooldown"),
    record("topic:a", "cooldown")
  ]);
  assert.equal(deduped.length, 2);
  assert.deepEqual(deduped.map((entry) => entry.uniqueContentKey).sort(), ["exact:a", "topic:a"]);
});

test("persisted candidate writes collapse duplicate primary keys before batching", () => {
  const deduped = dedupeKeyedItems([
    { candidateId: "candidate:a", version: 1 },
    { candidateId: "candidate:a", version: 2 },
    { candidateId: "candidate:b", version: 1 }
  ], (candidate) => candidate.candidateId);
  assert.deepEqual(deduped, [
    { candidateId: "candidate:a", version: 2 },
    { candidateId: "candidate:b", version: 1 }
  ]);
});

test("permanent exact keys are conditional while dated cooldown keys are overwriteable", () => {
  assert.equal(usedContentReservationCondition(record("exact:a", "permanent")), "attribute_not_exists(uniqueContentKey)");
  assert.equal(usedContentReservationCondition(record("topic:a", "cooldown")), undefined);
  const mixed = dedupeUsedContentRecords([record("same-key", "cooldown"), record("same-key", "permanent")]);
  assert.equal(mixed[0].reservationMode, "permanent", "permanent reservation wins an accidental mixed-mode duplicate");
});

test("candidate exact-key collisions retry another bounded candidate", async () => {
  const attempts: number[] = [];
  const value = await retryCandidateCollisions({
    gameId: "fixture",
    dateKey: "2026-12-12",
    operation: async (attempt) => {
      attempts.push(attempt);
      if (attempt < 2) throw new CandidateContentCollisionError("fixture", "2026-12-12", [`key:${attempt}`]);
      return "authoritative-winner";
    }
  });
  assert.equal(value, "authoritative-winner");
  assert.deepEqual(attempts, [0, 1, 2]);
});

test("candidate collision retry fails as pool exhaustion, not generic validation", async () => {
  await assert.rejects(() => retryCandidateCollisions({
    gameId: "fixture",
    dateKey: "2026-12-12",
    maxAttempts: 3,
    operation: async () => {
      throw new CandidateContentCollisionError("fixture", "2026-12-12", ["exact:used"]);
    }
  }), CandidatePoolExhaustedError);
});

test("infrastructure and validation errors are never mislabeled as duplicate collisions", async () => {
  await assert.rejects(() => retryCandidateCollisions({
    gameId: "fixture",
    dateKey: "2026-12-12",
    operation: async () => {
      throw new Error("network unavailable");
    }
  }), /network unavailable/);
});
