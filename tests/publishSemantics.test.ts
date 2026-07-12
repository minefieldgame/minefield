import assert from "node:assert/strict";
import test from "node:test";
import {
  CandidateContentCollisionError,
  CandidatePoolExhaustedError,
  buildCooldownWindowKeys,
  datedCooldownKey,
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

test("dated cooldown windows block out-of-order and concurrent nearby publications", () => {
  const base = "vaultbreak:secret:5278";
  const firstWindow = buildCooldownWindowKeys(base, "2028-05-10", 30);
  const nearbyWindow = buildCooldownWindowKeys(base, "2028-05-01", 30);
  const outsideWindow = buildCooldownWindowKeys(base, "2028-06-09", 30);
  const firstOwnKey = datedCooldownKey(base, "2028-05-10");
  const nearbyOwnKey = datedCooldownKey(base, "2028-05-01");
  const outsideOwnKey = datedCooldownKey(base, "2028-06-09");
  assert.equal(firstWindow.includes(nearbyOwnKey), true, "earlier admin generation must be visible in the later date's transaction checks");
  assert.equal(nearbyWindow.includes(firstOwnKey), true, "later admin generation must be visible in the earlier date's transaction checks");
  assert.equal(firstWindow.includes(outsideOwnKey), false, "the code may return once the full cooldown expires");
  assert.equal(outsideWindow.includes(firstOwnKey), false);
  assert.notEqual(firstOwnKey, nearbyOwnKey, "dated rows must never overwrite each other");
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
