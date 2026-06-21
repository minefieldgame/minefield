import { requestStructuredContent } from "@/lib/content/aiClient";
import { generateDailyContent, type GeneratedContentEnvelope } from "@/lib/content/dailyContentEngine";
import { hasCredibleSource } from "@/lib/content/sourceResolver";
import { buildValidation } from "@/lib/content/validation";
import type { CloserPuzzle, CloserScore } from "@/games/closer/types";

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["id", "category", "prompt", "answer", "unit", "displayAnswer", "sourceNote", "difficulty", "acceptableRangeNote", "confidence"],
  properties: {
    id: { type: "string" },
    category: { type: "string" },
    prompt: { type: "string" },
    answer: { type: "number" },
    unit: { type: "string" },
    displayAnswer: { type: "string" },
    sourceNote: { type: "string" },
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
    acceptableRangeNote: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 }
  }
} as const;

type GeneratedCloser = Omit<CloserPuzzle, "gameId" | "date" | "seed"> & { confidence: number };

export function validateCloserPuzzle(puzzle: CloserPuzzle) {
  return buildValidation({
    promptPresent: puzzle.prompt.trim().length >= 15,
    numericNonZeroAnswer: Number.isFinite(puzzle.answer) && puzzle.answer !== 0,
    unitClear: puzzle.unit.trim().length > 0,
    displayAnswerPresent: puzzle.displayAnswer.trim().length > 0,
    sourcePresent: hasCredibleSource([puzzle.sourceNote]),
    generalAudience: puzzle.prompt.length <= 180
  });
}

export async function resolveDailyCloserPuzzle(
  date: string,
  force = false
): Promise<GeneratedContentEnvelope<CloserPuzzle>> {
  return generateDailyContent({
    gameId: "closer",
    date,
    force,
    generate: async ({ seed }) => {
      const result = await requestStructuredContent<GeneratedCloser>({
        name: "minefield_closer",
        instructions:
          "Create one fast, factual numeric trivia question for a general audience. It must be easy to understand immediately, playable in under 30 seconds, unambiguous, non-zero, reasonably guessable, and supported by a reliable source. Favor famous heights, speeds, populations, movie grosses, animal facts, planets, major sports records, and familiar cultural milestones. Avoid obscure terminals, company divisions, quarterly metrics, narrow datasets, and hyper-specific methodology. Return only the schema.",
        input: `Pacific date ${date}; deterministic seed ${seed}. Vary across mainstream geography, sports, culture, science, history, animals, and technology.`,
        schema: SCHEMA,
        useWebSearch: true
      });
      const { confidence, ...content } = result.parsed;
      return {
        puzzle: { gameId: "closer", date, seed, ...content },
        rawAIResponse: result.raw,
        confidence,
        sourceNotes: [content.sourceNote],
        generator: `OpenAI Responses API (${result.model}) + web search`
      };
    },
    validate: validateCloserPuzzle,
    describe: (puzzle) => ({ topic: puzzle.category, answer: String(puzzle.answer), hashInput: puzzle.prompt })
  });
}

export const resolveCloserForDate = resolveDailyCloserPuzzle;

export function parseNumericGuess(input: string) {
  const normalized = input.trim().toLowerCase().replace(/[$,%\s,]/g, "");
  if (!normalized) return null;
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)(k|m|b|thousand|million|billion)?$/);
  if (!match) return null;
  const multipliers: Record<string, number> = {
    k: 1_000, thousand: 1_000, m: 1_000_000, million: 1_000_000,
    b: 1_000_000_000, billion: 1_000_000_000
  };
  return Number(match[1]) * (multipliers[match[2] ?? ""] ?? 1);
}

export const normalizeNumericGuess = parseNumericGuess;

export function calculateCloserScore(guess: number, answer: number): CloserScore {
  const distanceFromAnswer = Math.abs(guess - answer);
  const percentError = distanceFromAnswer / Math.abs(answer);
  const score =
    percentError <= 0.01 ? 100 : percentError <= 0.05 ? 90 : percentError <= 0.10 ? 80 :
    percentError <= 0.20 ? 65 : percentError <= 0.35 ? 50 : percentError <= 0.50 ? 35 :
    percentError <= 0.75 ? 20 : 0;
  const labels: Record<number, string> = {
    100: "Right on the money", 90: "Extremely close", 80: "Very close", 65: "Close one",
    50: "In the ballpark", 35: "A bit off", 20: "Way off", 0: "Not close"
  };
  return { score, percentError, distanceFromAnswer, scoreLabel: labels[score] };
}
