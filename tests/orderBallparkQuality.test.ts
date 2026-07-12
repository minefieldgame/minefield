import assert from "node:assert/strict";
import test from "node:test";
import {
  BALLPARK_CANDIDATES,
  IN_ORDER_CANDIDATES,
  validateBallparkInventoryDistribution,
  validateInOrderInventoryDistribution,
  validateNumericCandidate,
  validateObjectiveOrdering
} from "../lib/content/preparedInventories";

test("In Order prepared inventory is balanced, familiar, directional, and objectively ordered", () => {
  const distribution = validateInOrderInventoryDistribution(IN_ORDER_CANDIDATES);
  assert.equal(IN_ORDER_CANDIDATES.length, 600);
  assert.equal(distribution.valid, true, distribution.errors.join(" | "));
  assert.ok(Object.keys(distribution.counts).length >= 10);
  assert.ok(Math.max(...Object.values(distribution.counts)) <= IN_ORDER_CANDIDATES.length * 0.2);
  assert.ok((distribution.counts["mainstream-country-city-facts"] ?? 0) <= IN_ORDER_CANDIDATES.length * 0.15);
  assert.ok(IN_ORDER_CANDIDATES.every(validateObjectiveOrdering));
  assert.ok(IN_ORDER_CANDIDATES.every((candidate) => candidate.qualityApproved && candidate.familiarityScore >= 78));
  assert.equal(new Set(IN_ORDER_CANDIDATES.map((candidate) => `${candidate.metric}:${candidate.items.map(([name]) => name).sort().join("|")}`)).size, IN_ORDER_CANDIDATES.length);
  assert.ok(IN_ORDER_CANDIDATES.some((candidate) => candidate.direction === "highest-to-lowest"));
  assert.ok(IN_ORDER_CANDIDATES.some((candidate) => candidate.direction === "lowest-to-highest"));

  const tied = { ...IN_ORDER_CANDIDATES[0], numericValues: [5, 4, 4, 2, 1] };
  assert.equal(validateObjectiveOrdering(tied), false);
  assert.equal(validateObjectiveOrdering({ ...IN_ORDER_CANDIDATES[0], quality: undefined } as never), false);
});

test("Ballpark prepared inventory passes natural-language, quality, category, and tier gates", () => {
  const distribution = validateBallparkInventoryDistribution(BALLPARK_CANDIDATES);
  assert.ok(BALLPARK_CANDIDATES.length >= 500);
  assert.equal(distribution.valid, true, distribution.errors.join(" | "));
  assert.ok(BALLPARK_CANDIDATES.every(validateNumericCandidate));
  assert.ok(BALLPARK_CANDIDATES.every((candidate) => candidate.qualityApproved && candidate.qualityScore >= 72));
  assert.equal(new Set(BALLPARK_CANDIDATES.map((candidate) => candidate.prompt)).size, BALLPARK_CANDIDATES.length);
  assert.equal(new Set(BALLPARK_CANDIDATES.map((candidate) => candidate.topic)).size, BALLPARK_CANDIDATES.length);
  assert.equal(BALLPARK_CANDIDATES.filter((candidate) => /snapshot|structured[- ]data|indicator code|provider name/i.test(candidate.prompt)).length, 0);
  assert.equal(BALLPARK_CANDIDATES.filter((candidate) => /population density|\bratio\b|per capita|people per square/i.test(candidate.prompt)).length, 0);
  assert.deepEqual(
    [...new Set(BALLPARK_CANDIDATES.map((candidate) => candidate.difficultyTier))].sort(),
    ["approachable", "challenging", "standard"]
  );

  const badDensity = {
    ...BALLPARK_CANDIDATES[0],
    prompt: "About what is the population density of this tiny country?"
  };
  assert.equal(validateNumericCandidate(badDensity), false);
  const badInternalLanguage = {
    ...BALLPARK_CANDIDATES[0],
    prompt: "What value appears in the structured-data snapshot?"
  };
  assert.equal(validateNumericCandidate(badInternalLanguage), false);
  assert.equal(validateNumericCandidate({ ...BALLPARK_CANDIDATES[0], answer: BALLPARK_CANDIDATES[0].answer + 1 }), false);
  assert.equal(validateNumericCandidate({ ...BALLPARK_CANDIDATES[0], unit: "bananas" }), false);
  assert.equal(validateNumericCandidate({ ...BALLPARK_CANDIDATES[0], qualityDimensions: undefined } as never), false);
});
