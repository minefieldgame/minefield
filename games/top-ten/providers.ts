import { getAIStatus, requestStructuredContent } from "@/lib/content/aiClient";
import { generateDailyContent } from "@/lib/content/dailyContentEngine";
import { hasCredibleSource, normalizeSourceNotes } from "@/lib/content/sourceResolver";
import { buildValidation } from "@/lib/content/validation";
import { normalizeAnswer } from "@/games/top-ten/logic";
import type { TopTenAnswer, TopTenCategory, TopTenPuzzle, TopTenValidation } from "@/games/top-ten/types";

const TOPICS = [
  "music", "movies", "sports", "geography", "internet culture", "video games",
  "animals", "world records", "major brands", "simple history", "simple science"
];

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: [
    "title", "playerPrompt", "adminPrompt", "category", "rankingMetric",
    "expectedAnswerType", "sourceNote", "validationNote", "answers", "sources", "confidence"
  ],
  properties: {
    title: { type: "string" },
    playerPrompt: { type: "string" },
    adminPrompt: { type: "string" },
    category: { type: "string" },
    rankingMetric: { type: "string" },
    expectedAnswerType: { type: "string" },
    sourceNote: { type: "string" },
    validationNote: { type: "string" },
    answers: {
      type: "array", minItems: 3, maxItems: 3,
      items: {
        type: "object", additionalProperties: false,
        required: ["rank", "answer", "displayAnswer", "simplifiedTitle", "aliases", "value", "sourceNote"],
        properties: {
          rank: { type: "integer", minimum: 1, maximum: 3 },
          answer: { type: "string" },
          displayAnswer: { type: "string" },
          simplifiedTitle: { type: "string" },
          aliases: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 10 },
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
  playerPrompt: string;
  adminPrompt: string;
  category: string;
  rankingMetric: string;
  expectedAnswerType: string;
  sourceNote: string;
  validationNote: string;
  answers: Array<{
    rank: number;
    answer: string;
    displayAnswer: string;
    simplifiedTitle: string;
    aliases: string[];
    value: string;
    sourceNote: string;
  }>;
  sources: string[];
  confidence: number;
};

const ADMIN_LANGUAGE =
  /\b(using reputable|public tracker|current to|as of the pacific|according to reliable|based on available|verified by)\b/i;

export function cleanPlayerPrompt(value: string) {
  const firstSentence = value.split(/[.!?]/)[0].trim();
  const cleaned = firstSentence
    .replace(/,\s*(using|according to|based on|as of|current to|verified by).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").slice(0, 24);
  return `${words.join(" ").replace(/[,:;]+$/, "")}.`;
}

export function validateTopTenPuzzle(puzzle: TopTenPuzzle): TopTenValidation {
  const normalized = puzzle.answers.map((answer) => answer.name.trim().toLowerCase());
  const wordCount = puzzle.category.playerPrompt.trim().split(/\s+/).length;
  const checks = {
    rankedPrompt: /^name the top 3\b/i.test(puzzle.category.playerPrompt.trim()),
    exactlyThreeAnswers: puzzle.answers.length === 3,
    uniqueAnswers: new Set(normalized).size === 3 && normalized.every(Boolean),
    objectiveRanking: Boolean(puzzle.category.rankingMetric.trim()),
    safeAliases: puzzle.answers.every((answer) =>
      answer.aliases.length >= 2 &&
      answer.aliases.every((alias) => alias.trim().length > 0 && alias.length < 100)
    ),
    understandableCategory:
      wordCount <= 25 &&
      puzzle.category.playerPrompt.length <= 150 &&
      !ADMIN_LANGUAGE.test(puzzle.category.playerPrompt),
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
          "Generate an easy-to-medium general-audience Top 3 trivia prompt. Avoid niche, technical, obscure, hyper-specific, or methodology-heavy categories. The question should be understandable within 3 seconds and playable in under 30 seconds. Favor mainstream music, movies, sports, geography, internet culture, video games, animals, world records, major brands, simple history, or simple science. The playerPrompt must start with 'Name the top 3', sound like a human trivia host, contain under 15 words when possible and never more than 25, and contain no sourcing, date, validation, tracker, or methodology language. Put those details only in adminPrompt, sourceNote, and validationNote. Return exactly three objectively ranked answers. For every answer provide a short displayAnswer, simplifiedTitle, and several forgiving common aliases without official-video metadata.",
        input:
          `Pacific date ${date}; deterministic seed ${seed}; preferred topic ${topic}. ` +
          "Use reliable public web sources to verify the answers, but keep all source language out of playerPrompt.",
        schema: SCHEMA,
        useWebSearch: true
      });
      const playerPrompt = cleanPlayerPrompt(result.parsed.playerPrompt);
      const category: TopTenCategory = {
        id: `${date}-${seed.toString(16)}`,
        title: result.parsed.title,
        displayName: result.parsed.title,
        prompt: playerPrompt,
        playerPrompt,
        adminPrompt: result.parsed.adminPrompt,
        sourceNote: result.parsed.sourceNote,
        validationNote: result.parsed.validationNote,
        topicArea: result.parsed.category,
        rankingMetric: result.parsed.rankingMetric,
        expectedAnswerType: result.parsed.expectedAnswerType,
        answerType: result.parsed.expectedAnswerType,
        sourceStrategy: "OpenAI generation validated with web search sources",
        source: result.parsed.sources[0],
        aliasStrategy: "Generated short names plus token-overlap matching",
        difficulty: "easy",
        safetyRating: "safe"
      };
      const answers: TopTenAnswer[] = result.parsed.answers
        .sort((a, b) => a.rank - b.rank)
        .map((answer) => {
          const aliases = [...new Set([
            answer.displayAnswer,
            answer.simplifiedTitle,
            ...answer.aliases
          ].map((alias) => alias.trim()).filter(Boolean))];
          return {
            rank: answer.rank,
            name: answer.answer,
            displayAnswer: answer.displayAnswer,
            simplifiedTitle: answer.simplifiedTitle,
            aliases,
            normalizedTokens: [...new Set(
              [answer.answer, ...aliases].flatMap((alias) => normalizeAnswer(alias).split(" ")).filter(Boolean)
            )],
            value: answer.value,
            sourceNote: answer.sourceNote
          };
        });
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
      hashInput: {
        prompt: puzzle.category.playerPrompt,
        answers: puzzle.answers.map((answer) => answer.name)
      }
    })
  });
  return {
    ...envelope.puzzle,
    generatedAt: envelope.generatedAt,
    validation: envelope.validation as TopTenValidation,
    contentHash: envelope.contentHash,
    repeatCheck: envelope.repeatCheck,
    generator: envelope.generator,
    cacheHit: envelope.cacheHit,
    generationDurationMs: envelope.generationDurationMs
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
      : "OPENAI_API_KEY is missing. Add it in AWS Amplify environment variables."
  };
}
