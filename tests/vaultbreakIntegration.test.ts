import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { ACTIVE_GAME_IDS } from "../lib/gameDisplay";

function source(path: string) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

test("Vaultbreak is active immediately after Odd One Out and Sing Along stays retired", () => {
  assert.equal(ACTIVE_GAME_IDS[ACTIVE_GAME_IDS.indexOf("odd-one-out") + 1], "vaultbreak");
  assert.equal(ACTIVE_GAME_IDS.includes("sing-along" as never), false);
  assert.equal(ACTIVE_GAME_IDS.length, 9);
});

test("Vaultbreak route withholds the secret on GET and validates submissions on POST", () => {
  const route = source("../app/api/vaultbreak/route.ts");
  const logic = source("../games/vaultbreak/logic.ts");
  assert.match(route, /export async function GET/);
  assert.match(route, /toVaultbreakPlayerPayload\(puzzle\)/);
  assert.match(route, /export async function POST/);
  assert.match(route, /buildVaultbreakSubmissionResult\(puzzle, submittedCode, elapsedSeconds\)/);
  assert.match(route, /Admin access is required to publish a future Vaultbreak puzzle/);
  assert.match(route, /getPersistedPuzzle<ResolvedVaultbreakPuzzle>\("vaultbreak", date\)/);
  assert.match(route, /That archived Vaultbreak puzzle has not been published/);
  assert.match(route, /new Set\(submittedCode\)\.size !== 4/);
  assert.match(logic, /gameId: puzzle\.gameId/);
  const playerPayloadSource = logic.slice(logic.indexOf("export function toVaultbreakPlayerPayload"), logic.indexOf("export function toVaultbreakAdminPayload"));
  assert.doesNotMatch(playerPayloadSource, /secretCode:|seed:/);
});

test("Vaultbreak uses authoritative atomic publication with permanent exact keys and dated cooldowns", () => {
  const resolver = source("../lib/content/vaultbreakResolver.ts");
  assert.match(resolver, /getPersistedPuzzle<ResolvedVaultbreakPuzzle>\(GAME_ID, date\)/);
  assert.match(resolver, /retryCandidateCollisions/);
  assert.match(resolver, /publishDailyPuzzleWithUsedContent/);
  assert.match(resolver, /vaultbreak-exact-puzzle/);
  assert.match(resolver, /vaultbreak-normalized-clue-set/);
  assert.match(resolver, /vaultbreak-secret-cooldown/);
  assert.match(resolver, /vaultbreak-pattern-cooldown/);
  assert.match(resolver, /reservationMode: "cooldown"/);
  assert.match(resolver, /datedCooldownKey/);
  assert.match(resolver, /buildCooldownWindowKeys/);
  assert.match(resolver, /secretWindowKeys\.some\(\(key\) => usedDates\.has\(key\)\)/);
  assert.match(resolver, /conditionalAbsentUsedContentKeys: selectedReservationChecks/);
  assert.match(source("../lib/content/persistence.ts"), /ConditionCheck:[\s\S]*attribute_not_exists\(uniqueContentKey\)/);
});

test("Vaultbreak player assigns no authoritative puzzle in localStorage and exposes accessible controls", () => {
  const player = source("../games/vaultbreak/VaultbreakGame.tsx");
  assert.match(player, /fetchDailyPuzzle<VaultbreakPlayerPayload>/);
  assert.doesNotMatch(player, /generateVaultbreakPuzzle/);
  assert.match(player, /aria-label="Vault number keypad"/);
  assert.match(player, /Four distinct digits/);
  assert.match(player, /no countdown/);
  assert.match(player, /Submit final code/);
  assert.match(player, /Why this is the only code/);
});

test("Vaultbreak is wired into admin, review, share, and the production simulation", () => {
  assert.match(source("../components/admin/adminGameRegistry.tsx"), /gameId: "vaultbreak"/);
  assert.match(source("../components/admin/AdminVaultbreakPreview.tsx"), /Final solution count/);
  assert.match(source("../components/DailyAnswerReview.tsx"), /review\.type === "vaultbreak"/);
  assert.match(source("../components/DailySummary.tsx"), /result\.gameId === "vaultbreak"/);
  assert.match(source("../scripts/simulate-content-inventories.ts"), /new Set\(vaultbreakPuzzles\.map\(\(puzzle\) => vaultbreakNormalizedClueSetKey/);
});
