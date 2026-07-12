import { NextRequest, NextResponse } from "next/server";
import { buildVaultbreakSubmissionResult, toVaultbreakPlayerPayload } from "@/games/vaultbreak/logic";
import { resolveVaultbreakForDate } from "@/lib/content/vaultbreakResolver";
import { getPersistedPuzzle, puzzlePersistenceStatus } from "@/lib/content/persistence";
import type { ResolvedVaultbreakPuzzle } from "@/lib/content/vaultbreakResolver";
import { getPacificDateKey } from "@/lib/date";
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_VALUE } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
const ROUTE = "/api/vaultbreak";

function requestedDate(request: NextRequest) {
  const selected = request.nextUrl.searchParams.get("date");
  if (!selected) return getPacificDateKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(selected)) return null;
  const parsed = new Date(`${selected}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === selected ? selected : null;
}

function isAdmin(request: NextRequest) {
  return request.cookies.get(ADMIN_COOKIE_NAME)?.value === ADMIN_SESSION_VALUE;
}

async function loadAuthorizedPuzzle(request: NextRequest, date: string) {
  if (date === getPacificDateKey() || isAdmin(request)) return resolveVaultbreakForDate(date);
  return getPersistedPuzzle<ResolvedVaultbreakPuzzle>("vaultbreak", date);
}

export async function GET(request: NextRequest) {
  const date = requestedDate(request);
  if (!date) return NextResponse.json({ message: "Vaultbreak requires a valid calendar date." }, { status: 400 });
  if (date > getPacificDateKey() && !isAdmin(request)) return NextResponse.json({ message: "Admin access is required to publish a future Vaultbreak puzzle." }, { status: 403 });
  const datedRequest = request.nextUrl.searchParams.has("date");
  try {
    const puzzle = await loadAuthorizedPuzzle(request, date);
    if (!puzzle) return NextResponse.json({ message: "That archived Vaultbreak puzzle has not been published." }, { status: 404 });
    return NextResponse.json(toVaultbreakPlayerPayload(puzzle), {
      headers: { "Cache-Control": datedRequest ? "public, s-maxage=31536000, immutable" : "no-store" }
    });
  } catch (error) {
    console.error("[Vaultbreak unavailable]", { date, error: error instanceof Error ? error.message : error });
    return NextResponse.json({
      ok: false,
      gameId: "vaultbreak",
      date,
      message: "Today's Vaultbreak puzzle could not be loaded. Please try again shortly.",
      route: ROUTE,
      persistenceProvider: puzzlePersistenceStatus.provider
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: NextRequest) {
  const date = requestedDate(request);
  if (!date) return NextResponse.json({ message: "Vaultbreak requires a valid calendar date." }, { status: 400 });
  if (date > getPacificDateKey() && !isAdmin(request)) return NextResponse.json({ message: "Admin access is required to check a future Vaultbreak puzzle." }, { status: 403 });
  try {
    const body = await request.json() as { submittedCode?: unknown; elapsedSeconds?: unknown };
    const submittedCode = typeof body.submittedCode === "string" ? body.submittedCode : "";
    const elapsedSeconds = typeof body.elapsedSeconds === "number" ? body.elapsedSeconds : Number(body.elapsedSeconds);
    if (!/^\d{4}$/.test(submittedCode)) {
      return NextResponse.json({ message: "Enter exactly four digits before submitting." }, { status: 400 });
    }
    if (new Set(submittedCode).size !== 4) {
      return NextResponse.json({ message: "Vaultbreak submissions cannot repeat digits." }, { status: 400 });
    }
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      return NextResponse.json({ message: "Elapsed time must be a non-negative number." }, { status: 400 });
    }
    const puzzle = await loadAuthorizedPuzzle(request, date);
    if (!puzzle) return NextResponse.json({ message: "That archived Vaultbreak puzzle has not been published." }, { status: 404 });
    const result = buildVaultbreakSubmissionResult(puzzle, submittedCode, elapsedSeconds);
    return NextResponse.json({
      gameId: "vaultbreak",
      date,
      contentHash: puzzle.contentHash,
      ...result
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Vaultbreak submission failed]", { date, error: error instanceof Error ? error.message : error });
    return NextResponse.json({
      message: "Your Vaultbreak answer could not be checked. Please try again."
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
