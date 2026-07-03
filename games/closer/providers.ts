import { requestStructuredContent } from "@/lib/content/aiClient";
import { generateDailyContent, type GeneratedContentEnvelope } from "@/lib/content/dailyContentEngine";
import { hasCredibleSource } from "@/lib/content/sourceResolver";
import { buildValidation } from "@/lib/content/validation";
import type { CloserPuzzle, CloserScore } from "@/games/closer/types";
import type { CloserScoringProfile } from "@/games/closer/types";

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["id", "category", "prompt", "answer", "unit", "displayAnswer", "sourceNote", "difficulty", "acceptableRangeNote", "scoringProfile", "toleranceType", "confidence"],
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
    scoringProfile: { type: "string", enum: ["small-integer", "medium-count", "large-estimate", "year", "percentage"] },
    toleranceType: { type: "string", enum: ["absolute", "percent"] },
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
    generalAudience: puzzle.prompt.length <= 180,
    scoringProfileValid: puzzle.scoringProfile === inferCloserScoringProfile(puzzle),
    toleranceValid: puzzle.toleranceType === (puzzle.scoringProfile === "small-integer" || puzzle.scoringProfile === "year" || puzzle.scoringProfile === "percentage" ? "absolute" : "percent")
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
          "Create one fast, factual numeric trivia question for a general audience. Do not repeat or substantially overlap with USED_CONTENT_KEYS. A repeat includes the same factual answer identity, same prompt, same compared items, same category+answer, or same trivia item even if wording changes. Avoid common default examples and generic trivia-bank questions. Include scoringProfile and toleranceType. Use small-integer for low factual counts, medium-count for answers 20-999, large-estimate for populations/distances/money/measurements, year for calendar years, and percentage for percentages. Return only the schema.",
        input: `Pacific date ${date}; deterministic seed ${seed}. Vary across mainstream geography, sports, culture, science, history, animals, and technology. USED_CONTENT_KEYS are supplied by the app when persistence is enabled; generate content that avoids all prior prompt/answer/category identities.`,
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

export function inferCloserScoringProfile(
  puzzle: Pick<CloserPuzzle, "prompt" | "answer" | "unit">
): CloserScoringProfile {
  const context = `${puzzle.prompt} ${puzzle.unit}`.toLowerCase();
  if (/\b(year|what year|which year|when did)\b/.test(context) && puzzle.answer >= 1000 && puzzle.answer <= 2100) return "year";
  if (/%|percent|percentage/.test(context)) return "percentage";
  if (Number.isInteger(puzzle.answer) && puzzle.answer < 20 &&
      /\b(how many|number of|planets?|continents?|rings?|players?|members?|sides?|teams?)\b/.test(context)) return "small-integer";
  if (Math.abs(puzzle.answer) >= 20 && Math.abs(puzzle.answer) < 1000 &&
      !/\b(million|billion|distance|miles?|kilometers?|metres?|meters?|dollars?|population|box office|views?)\b/.test(context)) return "medium-count";
  return "large-estimate";
}

export function getCloserPlaceholder(puzzle: Pick<CloserPuzzle, "prompt" | "unit">) {
  const unit = puzzle.unit.trim();
  const context = `${puzzle.prompt} ${unit}`.toLowerCase();
  const promptAlreadyDefinesMeasurement =
    /\b(in|measured in|answer in)\s+(millions?|billions?|thousands?|feet|foot|miles?|meters?|metres?|kilometers?|kilometres?|years?|seconds?|minutes?|hours?|degrees?|percent|percentage)\b/.test(context);
  const conciseMeasurementUnit =
    /^(?:millions?|billions?|thousands?)(?:\s+of)?(?:\s+\w+){0,2}$|^(?:feet|foot|miles?|meters?|metres?|kilometers?|kilometres?|years?|seconds?|minutes?|hours?|degrees?|percent|percentage)$/i.test(unit);

  if (promptAlreadyDefinesMeasurement && conciseMeasurementUnit) {
    return `Enter your guess in ${unit}`;
  }
  return "Enter your guess";
}

export function calculateCloserScore(
  guess: number,
  answer: number,
  scoringProfile: CloserScoringProfile = "large-estimate"
): CloserScore {
  const distanceFromAnswer = Math.abs(guess - answer);
  const percentError = distanceFromAnswer / Math.abs(answer);
  let score = 0;
  let scoreLabel = "Not close";
  if (scoringProfile === "small-integer") {
    score = distanceFromAnswer === 0 ? 100 : distanceFromAnswer === 1 ? 70 : distanceFromAnswer === 2 ? 40 : 0;
    scoreLabel = score === 100 ? "Right on the money" : score === 70 ? "Close, but one off" : score === 40 ? "Two off" : "Not close";
  } else if (scoringProfile === "year") {
    score = distanceFromAnswer === 0 ? 100 : distanceFromAnswer <= 1 ? 90 : distanceFromAnswer <= 2 ? 75 : distanceFromAnswer <= 5 ? 50 : distanceFromAnswer <= 10 ? 25 : 0;
  } else if (scoringProfile === "percentage") {
    score = distanceFromAnswer <= 1 ? 100 : distanceFromAnswer <= 3 ? 90 : distanceFromAnswer <= 5 ? 75 : distanceFromAnswer <= 10 ? 50 : distanceFromAnswer <= 20 ? 25 : 0;
  } else if (scoringProfile === "medium-count") {
    score = percentError <= .02 ? 100 : percentError <= .05 ? 90 : percentError <= .10 ? 75 : percentError <= .20 ? 50 : percentError <= .35 ? 25 : 0;
  } else {
    score = percentError <= .01 ? 100 : percentError <= .05 ? 90 : percentError <= .10 ? 80 : percentError <= .20 ? 65 : percentError <= .35 ? 50 : percentError <= .50 ? 35 : percentError <= .75 ? 20 : 0;
  }
  if (scoringProfile !== "small-integer") {
    scoreLabel = score === 100 ? "Right on the money" : score >= 90 ? "Extremely close" : score >= 75 ? "Very close" : score >= 50 ? "In the ballpark" : score >= 25 ? "A bit off" : "Not close";
  }
  return { score, percentError, distanceFromAnswer, scoreLabel, scoringProfile };
}
