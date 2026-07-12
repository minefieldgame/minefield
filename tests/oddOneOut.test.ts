import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import type { OddOneOutCandidate } from "../games/odd-one-out/types";
import {
  ODD_ONE_OUT_CANDIDATES,
  ODD_ONE_OUT_INVENTORY,
  canonicalOddOneOutItemSet,
  oddOneOutExactDuplicateKey,
  selectOddOneOutCandidateForDate,
  validateOddOneOutCandidate,
  validateOddOneOutInventory
} from "../lib/content/oddOneOutInventory";
import { normalizeUsedContentText } from "../lib/content/usedContentRegistry";

function dateKeyFromOffset(offset: number) {
  return new Date(Date.UTC(2027, 0, 1 + offset)).toISOString().slice(0, 10);
}

test("Odd One Out prepared inventory is eligible, balanced, and source-backed", () => {
  assert.equal(ODD_ONE_OUT_INVENTORY.valid, true, ODD_ONE_OUT_INVENTORY.errors.join("\n"));
  assert.ok(ODD_ONE_OUT_INVENTORY.eligibleCount >= 1000);
  assert.equal(ODD_ONE_OUT_INVENTORY.rejectedCount, 0);
  assert.ok(ODD_ONE_OUT_INVENTORY.meaningfulCategoryCount >= 10);
  assert.ok(ODD_ONE_OUT_INVENTORY.maximumCategoryShare <= 0.2);
  assert.equal(Object.keys(ODD_ONE_OUT_INVENTORY.categoryDistribution).length, 17);
  assert.ok(Object.values(ODD_ONE_OUT_INVENTORY.categoryDistribution).every((count) => count >= 50));
  assert.ok(ODD_ONE_OUT_CANDIDATES.every((candidate) => candidate.sourceNote.length > 12));
  assert.ok(ODD_ONE_OUT_CANDIDATES.every((candidate) => candidate.sourceStrategy === "project-authored-source-backed-template"));
});

test("every eligible candidate has exactly five unique items and one in-set answer", () => {
  for (const candidate of ODD_ONE_OUT_INVENTORY.eligibleCandidates) {
    const validation = validateOddOneOutCandidate(candidate);
    assert.equal(validation.valid, true, `${candidate.id}: ${validation.errors.join("; ")}`);
    assert.equal(candidate.items.length, 5);
    assert.equal(new Set(candidate.items.map(normalizeUsedContentText)).size, 5);
    assert.equal(candidate.items.map(normalizeUsedContentText).filter((item) => item === normalizeUsedContentText(candidate.answer)).length, 1);
    assert.equal(candidate.matchingItems.length, 4);
    assert.ok(candidate.explanation.includes(";"), `${candidate.id} should explain its factual split in one sentence`);
  }
});

test("item-set identity is order-independent and duplicate sets are rejected", () => {
  const original = ODD_ONE_OUT_CANDIDATES[0];
  const reversedItems = [...original.items].reverse() as unknown as OddOneOutCandidate["items"];
  assert.equal(canonicalOddOneOutItemSet(original.items), canonicalOddOneOutItemSet(reversedItems));
  assert.equal(oddOneOutExactDuplicateKey(original.items), oddOneOutExactDuplicateKey(reversedItems));

  const duplicate: OddOneOutCandidate = {
    ...original,
    id: `${original.id}:duplicate-test`,
    items: reversedItems,
    exactDuplicateKey: oddOneOutExactDuplicateKey(reversedItems),
    duplicateKeys: [oddOneOutExactDuplicateKey(reversedItems)]
  };
  const result = validateOddOneOutInventory([original, duplicate]);
  assert.equal(result.valid, false);
  assert.equal(result.duplicateItemSetCount, 1);
  assert.equal(result.eligibleCount, 0);
});

test("ambiguity-review failures are rejected", () => {
  const original = ODD_ONE_OUT_CANDIDATES[0];
  const ambiguous = {
    ...original,
    ambiguityReview: {
      ...original.ambiguityReview,
      alternativesReviewed: false
    } as unknown as OddOneOutCandidate["ambiguityReview"]
  };
  const validation = validateOddOneOutCandidate(ambiguous);
  assert.equal(validation.valid, false);
  assert.equal(validation.checks.ambiguityReviewPassed, false);
});

test("daily selection is deterministic, tier-favoring, and has no exact repeats for 365 dates", () => {
  const date = "2027-07-12";
  const first = selectOddOneOutCandidateForDate(date);
  const second = selectOddOneOutCandidateForDate(date);
  assert.ok(first.candidate);
  assert.equal(second.candidate?.id, first.candidate.id);

  const usedExactKeys = new Set<string>();
  const selectedIds: string[] = [];
  const difficultyCounts = { approachable: 0, standard: 0, challenging: 0 };
  const categoryCounts = new Map<string, number>();
  for (let day = 0; day < 365; day += 1) {
    const selected = selectOddOneOutCandidateForDate(dateKeyFromOffset(day), ODD_ONE_OUT_INVENTORY.eligibleCandidates, {
      excludedExactKeys: usedExactKeys
    }).candidate;
    assert.ok(selected, `No candidate selected for day ${day}`);
    usedExactKeys.add(selected.exactDuplicateKey);
    selectedIds.push(selected.id);
    difficultyCounts[selected.difficulty] += 1;
    categoryCounts.set(selected.category, (categoryCounts.get(selected.category) ?? 0) + 1);
  }
  assert.equal(new Set(selectedIds).size, 365);
  assert.equal(usedExactKeys.size, 365);
  assert.ok(difficultyCounts.approachable + difficultyCounts.standard >= 320, JSON.stringify(difficultyCounts));
  assert.ok(difficultyCounts.challenging <= 45, JSON.stringify(difficultyCounts));
  assert.ok(Math.max(...categoryCounts.values()) <= 23, JSON.stringify(Object.fromEntries(categoryCounts)));
});

test("an exact collision deterministically advances to another candidate", () => {
  const date = "2028-03-03";
  const first = selectOddOneOutCandidateForDate(date).candidate;
  assert.ok(first);
  const replacementA = selectOddOneOutCandidateForDate(date, ODD_ONE_OUT_INVENTORY.eligibleCandidates, {
    excludedExactKeys: new Set([first.exactDuplicateKey])
  }).candidate;
  const replacementB = selectOddOneOutCandidateForDate(date, ODD_ONE_OUT_INVENTORY.eligibleCandidates, {
    excludedExactKeys: new Set([first.exactDuplicateKey])
  }).candidate;
  assert.ok(replacementA);
  assert.notEqual(replacementA.exactDuplicateKey, first.exactDuplicateKey);
  assert.equal(replacementA.id, replacementB?.id);
});

test("server resolver uses authoritative atomic publication and separate cooldown records", () => {
  const resolver = fs.readFileSync(new URL("../lib/content/oddOneOutResolver.ts", import.meta.url), "utf8");
  const route = fs.readFileSync(new URL("../app/api/odd-one-out/route.ts", import.meta.url), "utf8");
  assert.match(resolver, /getPersistedPuzzle<OddOneOutPuzzle>/);
  assert.match(resolver, /retryCandidateCollisions/);
  assert.match(resolver, /publishDailyPuzzleWithUsedContent/);
  assert.match(resolver, /uniqueContentKey: selection\.selected\.exactDuplicateKey/);
  assert.match(resolver, /reservationMode: "cooldown"/);
  assert.match(resolver, /semanticTopicKey/);
  assert.match(resolver, /answerKey/);
  assert.match(route, /resolveOddOneOutForDate/);
  assert.match(route, /NextResponse\.json\(puzzle/);
});
