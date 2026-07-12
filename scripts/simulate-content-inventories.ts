import assert from "node:assert/strict";
import { LANDMARKS } from "../data/landmarks";
import { isLandmarkEligible } from "../lib/content/landmarkQuality";
import { ODD_ONE_OUT_INVENTORY } from "../lib/content/oddOneOutInventory";
import {
  BALLPARK_CANDIDATES,
  BUZZWORD_CANDIDATES,
  IN_ORDER_CANDIDATES,
  validateBuzzwordCandidate
} from "../lib/content/preparedInventories";
import { simulateDailyInventory, type SimulationCandidate } from "../lib/content/inventorySimulation";
import { ACTIVE_GAME_IDS } from "../lib/gameDisplay";

const fixtures = (
  prefix: string,
  count: number,
  topics: number,
  categories: number,
  qualityTiers: readonly string[]
): SimulationCandidate[] => Array.from({ length: count }, (_, index) => ({
  id: `${prefix}-${index}`,
  softTopic: `${prefix}-topic-${index % topics}`,
  category: `${prefix}-category-${index % categories}`,
  qualityTier: qualityTiers[index % qualityTiers.length]
}));

const eligibleBuzzwords = BUZZWORD_CANDIDATES.filter(validateBuzzwordCandidate);
const eligibleLandmarks = LANDMARKS.filter(isLandmarkEligible);

const runs = [
  simulateDailyInventory({
    gameId: "needledrop",
    candidates: fixtures("rewind-provider", 4_000, 180, 10, ["iconic", "mainstream", "mainstream", "challenging"]),
    cooldownDays: 45,
    qualityTierWeights: { iconic: 8, mainstream: 7, challenging: 1 }
  }),
  simulateDailyInventory({
    gameId: "odd-one-out",
    candidates: ODD_ONE_OUT_INVENTORY.eligibleCandidates.map((item) => ({
      id: item.exactDuplicateKey,
      softTopic: item.semanticTopicKey,
      category: item.category,
      qualityTier: item.difficulty
    })),
    cooldownDays: 21,
    qualityTierWeights: { approachable: 6, standard: 4, challenging: 1 }
  }),
  simulateDailyInventory({
    gameId: "ranked-top-5",
    candidates: IN_ORDER_CANDIDATES.map((item) => ({
      id: item.id,
      softTopic: item.semanticTopic,
      category: item.categoryFamily,
      qualityTier: item.difficultyTier
    })),
    cooldownDays: 45,
    qualityTierWeights: { approachable: 6, standard: 4, challenging: 1 }
  }),
  simulateDailyInventory({
    gameId: "spelldrop",
    candidates: eligibleBuzzwords.map((item) => ({
      id: item.id,
      category: item.difficulty,
      qualityTier: item.difficulty
    })),
    cooldownDays: 90,
    qualityTierWeights: { easy: 6, medium: 4, hard: 1 }
  }),
  simulateDailyInventory({
    gameId: "closer",
    candidates: BALLPARK_CANDIDATES.map((item) => ({
      id: item.id,
      softTopic: item.topic,
      category: item.category,
      qualityTier: item.difficultyTier
    })),
    cooldownDays: 45,
    qualityTierWeights: { approachable: 6, standard: 4, challenging: 1 }
  }),
  simulateDailyInventory({
    gameId: "meet-me-halfway",
    candidates: fixtures("city-pair", 5_000, 250, 12, ["approachable", "standard"]),
    cooldownDays: 30
  }),
  simulateDailyInventory({
    gameId: "landmark-drop",
    candidates: eligibleLandmarks.map((item) => ({
      id: item.id,
      softTopic: `${item.country}:${item.category}`,
      category: item.continent,
      qualityTier: item.recognizabilityTier
    })),
    cooldownDays: 60,
    qualityTierWeights: { iconic: 14, recognizable: 7, challenging: 0.25 },
    preferredQualityTiers: ["iconic", "recognizable"],
    challengeSelectionRate: 0.06,
    preferQualityOverCooldown: true
  }),
  simulateDailyInventory({
    gameId: "minefield",
    candidates: fixtures("daily-board", 730, 365, 1, ["authoritative-board"]),
    cooldownDays: 0
  })
];

assert.deepEqual(runs.map((run) => run.gameId), [...ACTIVE_GAME_IDS], "Simulation must cover the complete active lineup in production order");
assert.equal(runs.some((run) => run.gameId === "sing-along"), false, "Retired Sing Along must not be part of active simulation");

for (const run of runs) {
  assert.equal(run.days, 365);
  assert.ok(run.initialInventory >= 365, `${run.gameId} does not have a full year of exact candidates`);
  assert.equal(run.exactRepeats, 0, `${run.gameId} repeated exact content`);
  assert.equal(new Set(run.selectedIds).size, 365, `${run.gameId} selected duplicate IDs`);
  assert.equal(run.replenishments, 0, `${run.gameId} should pass the release simulation from its validated starting inventory`);
}

const runByGame = new Map(runs.map((run) => [run.gameId, run]));
assert.ok(Object.keys(runByGame.get("odd-one-out")?.categoryDistribution ?? {}).length >= 10, "Odd One Out must retain broad category coverage in daily selection");
assert.ok(Object.keys(runByGame.get("ranked-top-5")?.categoryDistribution ?? {}).length >= 10, "In Order must retain at least ten category families");
assert.ok(Object.keys(runByGame.get("closer")?.categoryDistribution ?? {}).length >= 8, "Ballpark must retain broad category coverage");
assert.ok(Object.keys(runByGame.get("landmark-drop")?.categoryDistribution ?? {}).length >= 5, "Postcard must retain broad geographic coverage");
assert.ok((runByGame.get("needledrop")?.qualityTierDistribution.challenging ?? 0) <= 55, "Rewind simulation must strongly favor iconic/mainstream selections");
assert.ok((runByGame.get("landmark-drop")?.qualityTierDistribution.challenging ?? 0) <= 65, "Postcard challenging selections must stay controlled across a full no-repeat year");

console.log(JSON.stringify({
  days: 365,
  externalCalls: 0,
  activeGames: ACTIVE_GAME_IDS,
  games: runs.map(({ selectedIds, ...result }) => result)
}, null, 2));
