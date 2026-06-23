import "server-only";

import { validateTopTenPuzzle } from "@/games/top-ten/providers";
import { validateSpellDropPuzzle } from "@/games/spelldrop/providers";
import { inferCloserScoringProfile, validateCloserPuzzle } from "@/games/closer/providers";
import { resolveNeedleDropDiagnostic } from "@/lib/needledropResolver";
import type { RankedTopTenPuzzle } from "@/games/top-ten/types";
import type { SpellDropPuzzle } from "@/games/spelldrop/types";
import type { CloserPuzzle } from "@/games/closer/types";
import type { GeneratedContentEnvelope } from "@/lib/content/dailyContentEngine";
import { hashString } from "@/lib/dailySeed";
import { generateContentHash } from "@/lib/content/repeatPrevention";
import { deterministicEnvelope } from "@/lib/content/deterministicEnvelope";
import { BALLPARK_CATALOG, BUZZWORD_CATALOG, IN_ORDER_CATALOG } from "@/data/dailyPuzzleCatalogs";

export async function resolveRankedTop5ForDate(
  date: string,
  options: { force?: boolean; retryOffset?: number } = {}
): Promise<RankedTopTenPuzzle> {
  const seed = hashString(`ranked-top-5:${date}:0`);
  const entry = IN_ORDER_CATALOG[(seed + (options.retryOffset ?? 0)) % IN_ORDER_CATALOG.length];
  const answers = entry.items.map(([answer, value], index) => ({
    rank: index + 1,
    answer,
    displayAnswer: answer,
    aliases: [],
    value,
    sourceNote: entry.source
  }));
  const base = {
    gameId: "ranked-top-5" as const,
    id: `ranked-top-5:${date}`,
    date,
    title: entry.title,
    playerPrompt: entry.playerPrompt,
    adminPrompt: `${entry.playerPrompt} Metric: ${entry.metric}. Source: ${entry.source}`,
    category: entry.category,
    rankingMetric: entry.metric,
    direction: "highest-to-lowest" as const,
    answers,
    sources: [entry.source],
    confidence: 1,
    contentHash: "",
    generatedAt: `${date}T12:00:00.000Z`,
    generator: "Versioned deterministic daily catalog",
    cacheHit: true,
    generationDurationMs: 0,
    validation: { valid: false, checks: {} as RankedTopTenPuzzle["validation"]["checks"], errors: [] },
    rawAIResponse: null
  };
  const validation = validateTopTenPuzzle(base);
  return { ...base, validation, contentHash: generateContentHash({ date, entry }) };
}

export async function resolveSpellDropForDate(
  date: string,
  _force = false
): Promise<GeneratedContentEnvelope<SpellDropPuzzle>> {
  const seed = hashString(`spelldrop:${date}:0`);
  const entry = BUZZWORD_CATALOG[seed % BUZZWORD_CATALOG.length];
  const puzzle: SpellDropPuzzle = { gameId: "spelldrop", date, seed, ...entry };
  return deterministicEnvelope({
    gameId: "spelldrop", date, puzzle, validation: validateSpellDropPuzzle(puzzle),
    topic: "commonly misspelled English words", answer: puzzle.word,
    sourceNotes: ["Versioned Minefield lexical catalog"]
  });
}

export async function resolveCloserForDate(
  date: string,
  _force = false
): Promise<GeneratedContentEnvelope<CloserPuzzle>> {
  const seed = hashString(`closer:${date}:0`);
  const entry = BALLPARK_CATALOG[seed % BALLPARK_CATALOG.length];
  const scoringProfile = inferCloserScoringProfile(entry);
  const puzzle: CloserPuzzle = {
    gameId: "closer", date, seed, ...entry, scoringProfile,
    toleranceType: scoringProfile === "small-integer" || scoringProfile === "year" || scoringProfile === "percentage" ? "absolute" : "percent"
  };
  return deterministicEnvelope({
    gameId: "closer", date, puzzle, validation: validateCloserPuzzle(puzzle),
    topic: puzzle.category, answer: String(puzzle.answer), sourceNotes: [puzzle.sourceNote]
  });
}

export async function resolveNeedleDropForDate(date: string) {
  return resolveNeedleDropDiagnostic(date);
}
