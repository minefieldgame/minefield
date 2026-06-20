import { getAIStatus, requestStructuredContent } from "@/lib/content/aiClient";
import { generateDailyContent } from "@/lib/content/dailyContentEngine";
import { hasCredibleSource, normalizeSourceNotes } from "@/lib/content/sourceResolver";
import { buildValidation } from "@/lib/content/validation";
import type { TopTenAnswer, TopTenCategory, TopTenPuzzle, TopTenValidation } from "@/games/top-ten/types";

const TOPICS = [
  "sports", "music", "movies", "geography", "history", "animals",
  "science", "business", "technology", "video games", "literature", "internet culture"
];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "prompt", "category", "rankingMetric", "expectedAnswerType", "answers", "sources", "confidence"],
  properties: {
    title: { type: "string" },
    prompt: { type: "string" },
    category: { type: "string" },
    rankingMetric: { type: "string" },
    expectedAnswerType: { type: "string" },
    answers: {
      type: "array", minItems: 3, maxItems: 3,
      items: {
        type: "object", additionalProperties: false,
        required: ["rank", "answer", "aliases", "value", "sourceNote"],
        properties: {
          rank: { type: "integer", minimum: 1, maximum: 3 },
          answer: { type: "string" },
          aliases: { type: "array", items: { type: "string" }, maxItems: 8 },
          value: { type: "string" },
          sourceNote: { type: "string" }
        }
      }
    },
    sources: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
    confidence: { type: "number", minimum: 0, maximum: 1 }
  }
} as const;

type GeneratedTopThree = {
  title: string;
  prompt: string;
  category: string;
  rankingMetric: string;
  expectedAnswerType: string;
  answers: Array<{ rank: number; answer: string; aliases: string[]; value: string; sourceNote: string }>;
  sources: string[];
  confidence: number;
};

export function validateTopTenPuzzle(puzzle: TopTenPuzzle): TopTenValidation {
  const normalized = puzzle.answers.map((answer) => answer.name.trim().toLowerCase());
  const checks = {
    rankedPrompt: /^name the top 3\b/i.test(puzzle.category.prompt.trim()),
    exactlyThreeAnswers: puzzle.answers.length === 3,
    uniqueAnswers: new Set(normalized).size === 3 && normalized.every(Boolean),
    objectiveRanking: Boolean(puzzle.category.rankingMetric.trim()),
    safeAliases: puzzle.answers.every((answer) => answer.aliases.every((alias) => alias.trim().length > 0 && alias.length < 100)),
    understandableCategory: puzzle.category.prompt.length >= 20 && puzzle.category.prompt.length <= 180,
    reliableSources: hasCredibleSource(puzzle.sources)
  };
  return buildValidation(checks) as TopTenValidation;
}

export async function resolveDailyTopTenPuzzle(
  date: string,
  options: { force?: boolean; retryOffset?: number } = {}
): Promise<TopTenPuzzle> {
  const envelope = await generateDailyContent({
    gameId: "top3",
    date,
    force: options.force,
    generate: async ({ seed, attempt }) => {
      const topic = TOPICS[(seed + attempt) % TOPICS.length];
      const result = await requestStructuredContent<GeneratedTopThree>({
        name: "minefield_top_three",
        instructions:
          "Create one objective, broadly understandable Top 3 trivia puzzle. Use current reliable sources. Never use opinion rankings. Date-stamp facts that can change. Return exactly three uniquely ranked answers and conservative aliases.",
        input:
          `Pacific date ${date}; deterministic seed ${seed}; required topic ${topic}. ` +
          "The prompt must begin 'Name the top 3'. Verify the ranking with authoritative or reputable public sources.",
        schema: SCHEMA,
        useWebSearch: true
      });
      const category: TopTenCategory = {
        id: `${date}-${seed.toString(16)}`,
        title: result.parsed.title,
        displayName: result.parsed.title,
        prompt: result.parsed.prompt,
        topicArea: result.parsed.category,
        rankingMetric: result.parsed.rankingMetric,
        expectedAnswerType: result.parsed.expectedAnswerType,
        answerType: result.parsed.expectedAnswerType,
        sourceStrategy: "OpenAI generation validated with web search sources",
        source: result.parsed.sources[0],
        aliasStrategy: "Conservative generated aliases",
        difficulty: "medium",
        safetyRating: "safe"
      };
      const answers: TopTenAnswer[] = result.parsed.answers
        .sort((a, b) => a.rank - b.rank)
        .map((answer) => ({
          rank: answer.rank,
          name: answer.answer,
          aliases: answer.aliases,
          value: answer.value,
          sourceNote: answer.sourceNote
        }));
      const puzzle: TopTenPuzzle = {
        id: `${date}:${category.id}`,
        date,
        category,
        answers,
        sources: normalizeSourceNotes(result.parsed.sources),
        sourceUrl: result.parsed.sources[0] ?? "",
        generatedAt: new Date().toISOString(),
        confidence: result.parsed.confidence,
        validation: { valid: false, checks: {} as TopTenValidation["checks"], errors: [] },
        generationMode: "live-ai",
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
      topic: puzzle.category.topicArea,
      answer: puzzle.answers.map((answer) => answer.name).join("|"),
      hashInput: { prompt: puzzle.category.prompt, answers: puzzle.answers.map((answer) => answer.name) }
    })
  });
  return {
    ...envelope.puzzle,
    generatedAt: envelope.generatedAt,
    validation: envelope.validation as TopTenValidation,
    contentHash: envelope.contentHash,
    repeatCheck: envelope.repeatCheck,
    generator: envelope.generator
  };
}

export function getAvailableTopTenCategories() {
  return TOPICS.map((topicArea) => ({ topicArea, mode: "AI generated" }));
}

export function getTopTenProviderStatus() {
  const status = getAIStatus();
  return {
    mode: status.liveGenerationEnabled ? "live-ai" : "unavailable",
    model: status.model,
    apiKeyConfigured: status.apiKeyConfigured,
    warning: status.apiKeyConfigured
      ? null
      : "OPENAI_API_KEY is missing. Top 3 live generation is unavailable."
  };
}
