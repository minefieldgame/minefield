import { getAIStatus, requestStructuredContent } from "@/lib/content/aiClient";
import { generateDailyContent } from "@/lib/content/dailyContentEngine";
import { hasCredibleSource, normalizeSourceNotes } from "@/lib/content/sourceResolver";
import { buildValidation } from "@/lib/content/validation";
import type {
  RankedTopTenAnswer,
  RankedTopTenPuzzle,
  RankedTopTenValidation
} from "@/games/top-ten/types";

const TOPICS = [
  "countries by population",
  "movies by worldwide box office",
  "NBA players by career points",
  "animals by top speed",
  "video game consoles by lifetime sales",
  "planets by size",
  "US states by population",
  "albums by certified sales",
  "mountains by height",
  "rivers by length"
];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title", "playerPrompt", "adminPrompt", "category", "rankingMetric",
    "direction", "answers", "sources", "confidence"
  ],
  properties: {
    title: { type: "string" },
    playerPrompt: { type: "string" },
    adminPrompt: { type: "string" },
    category: { type: "string" },
    rankingMetric: { type: "string" },
    direction: { type: "string", enum: ["highest-to-lowest", "lowest-to-highest"] },
    answers: {
      type: "array",
      minItems: 10,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["rank", "answer", "displayAnswer", "aliases", "value", "sourceNote"],
        properties: {
          rank: { type: "integer", minimum: 1, maximum: 10 },
          answer: { type: "string" },
          displayAnswer: { type: "string" },
          aliases: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 5 },
          value: { type: "string" },
          sourceNote: { type: "string" }
        }
      }
    },
    sources: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
    confidence: { type: "number", minimum: 0, maximum: 1 }
  }
} as const;

type GeneratedRankedTopTen = {
  title: string;
  playerPrompt: string;
  adminPrompt: string;
  category: string;
  rankingMetric: string;
  direction: "highest-to-lowest" | "lowest-to-highest";
  answers: RankedTopTenAnswer[];
  sources: string[];
  confidence: number;
};

const UNSUITABLE = /\b(war|deaths?|casualties|quarterly|market cap|revenue|political|election)\b/i;

export function validateTopTenPuzzle(puzzle: RankedTopTenPuzzle): RankedTopTenValidation {
  const answers = puzzle.answers;
  const normalized = answers.map((answer) => answer.answer.trim().toLowerCase());
  const ranks = answers.map((answer) => answer.rank).sort((a, b) => a - b);
  const wordCount = puzzle.playerPrompt.trim().split(/\s+/).length;
  const checks = {
    exactlyTenAnswers: answers.length === 10,
    sequentialRanks: ranks.join(",") === "1,2,3,4,5,6,7,8,9,10",
    uniqueAnswers: normalized.every(Boolean) && new Set(normalized).size === 10,
    valuesPresent: answers.every((answer) => answer.value.trim().length > 0),
    directionClear: ["highest-to-lowest", "lowest-to-highest"].includes(puzzle.direction),
    objectiveCategory: puzzle.rankingMetric.trim().length > 2,
    generalAudience: !UNSUITABLE.test(`${puzzle.category} ${puzzle.playerPrompt}`),
    concisePlayerPrompt: wordCount <= 25 && puzzle.playerPrompt.length <= 160,
    sourceNotesPresent: answers.every((answer) => answer.sourceNote.trim().length > 0),
    reliableSources: hasCredibleSource(puzzle.sources)
  };
  return buildValidation(checks) as RankedTopTenValidation;
}

export async function resolveDailyTopTenPuzzle(
  date: string,
  options: { force?: boolean; retryOffset?: number } = {}
): Promise<RankedTopTenPuzzle> {
  const retryOffset = options.retryOffset ?? 0;
  const envelope = await generateDailyContent({
    gameId: "ranked-top-10",
    date,
    force: options.force,
    attempts: 3,
    generate: async ({ seed, attempt }) => {
      const topic = TOPICS[(seed + attempt + retryOffset) % TOPICS.length];
      const result = await requestStructuredContent<GeneratedRankedTopTen>({
        name: "minefield_ranked_top_10",
        instructions:
          "Create one objective, easy-to-medium general-audience ranking game with exactly 10 familiar items. The player will reorder supplied items, so never ask them to name answers. Use a stable metric and clear direction. Avoid obscure, technical, political, grim, daily-changing, or methodology-heavy topics. playerPrompt must be natural, under 25 words, and start with 'Rank these 10'. Put sourcing and caveats only in adminPrompt and sourceNote. Verify ranks and values with reputable web sources.",
        input:
          `Pacific date ${date}; deterministic seed ${seed}; preferred category ${topic}; variant ${retryOffset}. ` +
          "Return ranks 1 through 10 in correct order, concise display names, values, aliases, per-item source notes, and source URLs.",
        schema: SCHEMA,
        useWebSearch: true
      });
      const answers = [...result.parsed.answers]
        .sort((left, right) => left.rank - right.rank)
        .map((answer) => ({
          ...answer,
          answer: answer.answer.trim(),
          displayAnswer: answer.displayAnswer.trim(),
          aliases: [...new Set(answer.aliases.map((alias) => alias.trim()).filter(Boolean))]
        }));
      const puzzle: RankedTopTenPuzzle = {
        gameId: "ranked-top-10",
        id: `ranked-top-10:${date}`,
        date,
        title: result.parsed.title,
        playerPrompt: result.parsed.playerPrompt.trim(),
        adminPrompt: result.parsed.adminPrompt.trim(),
        category: result.parsed.category.trim(),
        rankingMetric: result.parsed.rankingMetric.trim(),
        direction: result.parsed.direction,
        answers,
        sources: normalizeSourceNotes(result.parsed.sources),
        confidence: result.parsed.confidence,
        generatedAt: new Date().toISOString(),
        validation: { valid: false, checks: {} as RankedTopTenValidation["checks"], errors: [] },
        rawAIResponse: result.raw
      };
      return {
        puzzle,
        rawAIResponse: result.raw,
        confidence: result.parsed.confidence,
        sourceNotes: result.parsed.sources,
        generator: `OpenAI Responses API (${result.model}) + web search`
      };
    },
    validate: validateTopTenPuzzle,
    describe: (puzzle) => ({
      topic: puzzle.category,
      answer: puzzle.answers.map((answer) => answer.answer).join("|"),
      hashInput: {
        prompt: puzzle.playerPrompt,
        answers: puzzle.answers.map((answer) => [answer.rank, answer.answer, answer.value])
      }
    })
  });
  return {
    ...envelope.puzzle,
    generatedAt: envelope.generatedAt,
    validation: envelope.validation as RankedTopTenValidation,
    contentHash: envelope.contentHash,
    generator: envelope.generator,
    cacheHit: envelope.cacheHit,
    generationDurationMs: envelope.generationDurationMs,
    rawAIResponse: envelope.rawAIResponse
  };
}

export const resolveRankedTop10ForDate = resolveDailyTopTenPuzzle;

export function getAvailableTopTenCategories() {
  return TOPICS.map((category) => ({ category, mode: "AI generated" }));
}

export function getTopTenProviderStatus() {
  const status = getAIStatus();
  return {
    mode: status.liveGenerationEnabled ? "live-ai" : "unavailable",
    model: status.model,
    apiKeyConfigured: status.apiKeyConfigured,
    warning: status.apiKeyConfigured
      ? null
      : "OPENAI_API_KEY is missing. Add it in AWS Amplify environment variables."
  };
}
