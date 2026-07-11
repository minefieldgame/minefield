import assert from "node:assert/strict";
import { LANDMARKS } from "../data/landmarks";
import { BALLPARK_CANDIDATES, BUZZWORD_CANDIDATES, IN_ORDER_CANDIDATES } from "../lib/content/preparedInventories";
import { simulateDailyInventory, type SimulationCandidate } from "../lib/content/inventorySimulation";

const fixtures = (prefix: string, count: number, topics: number): SimulationCandidate[] =>
  Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}`, softTopic: `${prefix}-topic-${index % topics}` }));

const runs = [
  simulateDailyInventory({ gameId: "needledrop", candidates: fixtures("rewind-provider-fixture", 4000, 120), replenishBelow: 1200, cooldownDays: 45 }),
  simulateDailyInventory({ gameId: "sing-along", candidates: fixtures("reviewed-timing-provider-fixture", 1200, 180), replenishBelow: 400, cooldownDays: 60 }),
  simulateDailyInventory({ gameId: "ranked-top-5", candidates: IN_ORDER_CANDIDATES.map((item) => ({ id: item.id, softTopic: item.semanticTopic })), replenishBelow: 200, replenish: (round) => fixtures(`in-order-structured-replenishment-${round}`, 500, 80), cooldownDays: 45 }),
  simulateDailyInventory({ gameId: "spelldrop", candidates: BUZZWORD_CANDIDATES.map((item) => ({ id: item.id, softTopic: item.difficulty })), replenishBelow: 2000, cooldownDays: 90 }),
  simulateDailyInventory({ gameId: "closer", candidates: BALLPARK_CANDIDATES.map((item) => ({ id: item.id, softTopic: item.category })), replenishBelow: 800, cooldownDays: 45 }),
  simulateDailyInventory({ gameId: "landmark-drop", candidates: LANDMARKS.map((item) => ({ id: item.id, softTopic: `${item.country}:${item.category}` })), replenishBelow: 200, replenish: (round) => fixtures(`wikidata-commons-replenishment-${round}`, 500, 100), cooldownDays: 60 }),
  simulateDailyInventory({ gameId: "meet-me-halfway", candidates: fixtures("city-pair", 5000, 250), replenishBelow: 1000, cooldownDays: 30 })
];

for (const run of runs) {
  assert.equal(run.days, 365);
  assert.equal(run.exactRepeats, 0, `${run.gameId} repeated exact content`);
  assert.equal(new Set(run.selectedIds).size, 365, `${run.gameId} selected duplicate IDs`);
}
console.log(JSON.stringify({ days: 365, externalCalls: 0, games: runs.map(({ selectedIds, ...result }) => result) }, null, 2));
