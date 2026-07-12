import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_VALUE } from "@/lib/adminAuth";
import { getInventoryOverview } from "@/lib/content/inventoryHealth";
import { replenishModelCandidates } from "@/lib/content/modelReplenishment";
import { replenishLandmarkCandidates } from "@/lib/content/landmarkInventory";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  return request.cookies.get(ADMIN_COOKIE_NAME)?.value === ADMIN_SESSION_VALUE;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    games: await getInventoryOverview(),
    retiredGames: [{ gameId: "sing-along", status: "retired", replenishmentEnabled: false }]
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const before = await getInventoryOverview();
  const results = [];
  for (const game of before) {
    if (game.unusedInventory >= game.replenishBelow) {
      results.push({ gameId: game.gameId, status: "healthy-skipped", generated: 0, validated: 0, rejected: 0, message: `Inventory ${game.unusedInventory} is above threshold ${game.replenishBelow}.` });
      continue;
    }
    if (game.gameId === "spelldrop" || game.gameId === "closer" || game.gameId === "ranked-top-5") {
      try {
        const replenished = await replenishModelCandidates(game.gameId, `admin:${Date.now()}:${game.gameId}`);
        results.push({ ...replenished, status: replenished.validated ? "replenished" : "validation-failure", message: `${replenished.validated} of ${replenished.generated} model-ideated candidates passed deterministic validation.` });
      } catch (error) {
        results.push({ gameId: game.gameId, status: "provider-unavailable", generated: 0, validated: 0, rejected: 0, message: error instanceof Error ? error.message : "Model replenishment failed." });
      }
      continue;
    }
    if (game.gameId === "landmark-drop") {
      try {
        const replenished = await replenishLandmarkCandidates(`admin:${Date.now()}`, 100);
        results.push({ gameId: game.gameId, status: replenished.validated ? "replenished" : "validation-failure", ...replenished, message: `${replenished.validated} newly discovered Commons photographs passed validation.` });
      } catch (error) {
        results.push({ gameId: game.gameId, status: "provider-unavailable", generated: 0, validated: 0, rejected: 0, message: error instanceof Error ? error.message : "Landmark replenishment failed." });
      }
      continue;
    }
    if (game.gameId === "odd-one-out" || game.gameId === "meet-me-halfway") {
      results.push({
        gameId: game.gameId,
        status: "manual-curation-required",
        generated: 0,
        validated: 0,
        rejected: 0,
        message: "This game uses a complete validated prepared inventory. New candidates require source-backed authoring and deterministic review."
      });
      continue;
    }
    results.push({ gameId: game.gameId, status: "validation-failure", generated: 0, validated: 0, rejected: 0, message: "No automatic provider is permitted to bypass this game's factual/media validator." });
  }
  return NextResponse.json({
    startedAt: new Date().toISOString(),
    results,
    games: await getInventoryOverview(),
    retiredGames: [{ gameId: "sing-along", status: "retired", replenishmentEnabled: false }]
  }, { headers: { "Cache-Control": "no-store" } });
}
