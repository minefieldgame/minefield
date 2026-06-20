import { hashString } from "@/lib/dailySeed";
import type {
  TopTenAnswer,
  TopTenCategory,
  TopTenPuzzle,
  TopTenValidation
} from "@/games/top-ten/types";

const TOPIC_AREAS = [
  "Sports", "Music", "Movies", "TV", "Geography", "History", "Science",
  "Animals", "Food", "Video games", "Internet culture", "Business",
  "Technology", "Literature", "World records"
];

const CATEGORY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "id", "title", "prompt", "topicArea", "rankingMetric",
    "expectedAnswerType", "sourceStrategy", "difficulty", "safetyRating"
  ],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    prompt: { type: "string" },
    topicArea: { type: "string" },
    rankingMetric: { type: "string" },
    expectedAnswerType: { type: "string" },
    sourceStrategy: { type: "string" },
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
    safetyRating: { type: "string", enum: ["safe"] }
  }
} as const;

const RESOLUTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answers", "sources", "confidence", "objectiveRanking", "sourceReliable"],
  properties: {
    answers: {
      type: "array",
      minItems: 10,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["rank", "name", "aliases", "value", "sourceNote"],
        properties: {
          rank: { type: "integer", minimum: 1, maximum: 10 },
          name: { type: "string" },
          aliases: { type: "array", items: { type: "string" }, maxItems: 8 },
          value: { type: "string" },
          sourceNote: { type: "string" }
        }
      }
    },
    sources: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    objectiveRanking: { type: "boolean" },
    sourceReliable: { type: "boolean" }
  }
} as const;

type OpenAIResponse = {
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

type Resolution = {
  answers: TopTenAnswer[];
  sources: string[];
  confidence: number;
  objectiveRanking: boolean;
  sourceReliable: boolean;
};

const dailyCache = new Map<string, TopTenPuzzle>();

function outputText(response: OpenAIResponse) {
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  throw new Error("OpenAI response did not contain structured output.");
}

async function callOpenAI<T>(body: Record<string, unknown>): Promise<{ parsed: T; raw: OpenAIResponse }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  const raw = (await response.json()) as OpenAIResponse & { error?: { message?: string } };
  if (!response.ok) throw new Error(raw.error?.message ?? "OpenAI request failed.");
  return { parsed: JSON.parse(outputText(raw)) as T, raw };
}

function topicForDate(date: string, attempt: number) {
  const dayNumber = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  const offset = hashString("minefield-topic-cycle") % TOPIC_AREAS.length;
  return TOPIC_AREAS[(dayNumber + offset + attempt * 5) % TOPIC_AREAS.length];
}

export async function generateTopTenCategory(date: string, attempt = 0) {
  const topicArea = topicForDate(date, attempt);
  if (!process.env.OPENAI_API_KEY) {
    const mock = mockCategoryForDate(date, attempt);
    return { category: mock.category, rawAIResponse: null, mode: "development-mock" as const };
  }

  const seed = hashString(`minefield:top-ten:${date}:${attempt}`);
  const { parsed, raw } = await callOpenAI<Omit<TopTenCategory, "displayName" | "source" | "answerType" | "aliasStrategy">>({
    model: process.env.OPENAI_MODEL ?? "gpt-5.5",
    instructions:
      "You create safe, objective daily Top 10 trivia categories. Never create opinion rankings, political controversy, private-data rankings, or categories whose order changes hourly. The prompt must begin with 'Name the top 10'. Return only the requested schema.",
    input:
      `Date: ${date}. Deterministic seed: ${seed}. Required topic area: ${topicArea}. ` +
      "Create one clear, broadly understandable category with an objective ranking, exactly ten retrievable answers, and a reliable public web source strategy.",
    text: {
      format: {
        type: "json_schema",
        name: "top_ten_category",
        strict: true,
        schema: CATEGORY_SCHEMA
      }
    }
  });
  const category: TopTenCategory = {
    ...parsed,
    displayName: parsed.title,
    source: parsed.sourceStrategy,
    answerType: parsed.expectedAnswerType,
    aliasStrategy: "AI-generated safe aliases"
  };
  if (category.topicArea.toLowerCase() !== topicArea.toLowerCase()) {
    throw new Error(`AI returned topic area ${category.topicArea}; expected ${topicArea}.`);
  }
  if (!/^name the top 10\b/i.test(category.prompt.trim())) {
    throw new Error("AI category prompt did not use the required Top 10 format.");
  }
  return { category, rawAIResponse: raw, mode: "live-ai" as const };
}

export async function resolveTopTenCategory(category: TopTenCategory, date: string) {
  if (!process.env.OPENAI_API_KEY) {
    const mock = MOCK_CATEGORIES.find((entry) => entry.category.id === category.id);
    if (!mock) throw new Error("Development mock has no resolver for this category.");
    return {
      resolution: {
        answers: mock.answers,
        sources: mock.sources,
        confidence: 0.96,
        objectiveRanking: true,
        sourceReliable: true
      },
      rawResolvedResponse: { provider: "development-mock", categoryId: category.id }
    };
  }

  const { parsed, raw } = await callOpenAI<Resolution>({
    model: process.env.OPENAI_MODEL ?? "gpt-5.5",
    instructions:
      "Resolve an objective Top 10 trivia category using current reliable public web sources. Use web search. Return exactly ten uniquely ranked answers. Add conservative aliases only: common abbreviations, established alternate names, and famous last names when unambiguous. Never invent values or aliases.",
    input:
      `Resolve this category for the Minefield daily game dated ${date}: ${JSON.stringify(category)}. ` +
      "Prefer authoritative statistics, official bodies, reputable reference works, or well-established industry sources. Include source URLs.",
    tools: [{ type: "web_search" }],
    text: {
      format: {
        type: "json_schema",
        name: "top_ten_resolution",
        strict: true,
        schema: RESOLUTION_SCHEMA
      }
    }
  });
  return { resolution: parsed, rawResolvedResponse: raw };
}

export function validateTopTenPuzzle(puzzle: TopTenPuzzle): TopTenValidation {
  const normalized = puzzle.answers.map((answer) => answer.name.trim().toLowerCase());
  const checks = {
    rankedPrompt: /^name the top 10\b/i.test(puzzle.category.prompt.trim()),
    exactlyTenAnswers: puzzle.answers.length === 10,
    uniqueAnswers: new Set(normalized).size === 10 && normalized.every(Boolean),
    objectiveRanking: Boolean(puzzle.validation?.checks?.objectiveRanking ?? true),
    safeAliases: puzzle.answers.every((answer) =>
      answer.aliases.every((alias) => alias.trim().length > 0 && alias.length < 100)
    ),
    understandableCategory:
      puzzle.category.prompt.length >= 20 && puzzle.category.prompt.length <= 180,
    reliableSources: puzzle.sources.length > 0
  };
  const errors = Object.entries(checks)
    .filter(([, valid]) => !valid)
    .map(([name]) => `Validation failed: ${name}`);
  return { valid: errors.length === 0, checks, errors };
}

export async function resolveDailyTopTenPuzzle(
  date: string,
  options: { force?: boolean; retryOffset?: number } = {}
): Promise<TopTenPuzzle> {
  if (!options.force && dailyCache.has(date)) return dailyCache.get(date)!;
  const failures: string[] = [];

  for (let retry = 0; retry < 3; retry += 1) {
    const attempt = retry + (options.retryOffset ?? 0);
    try {
      const generated = await generateTopTenCategory(date, attempt);
      const resolved = await resolveTopTenCategory(generated.category, date);
      const provisional: TopTenPuzzle = {
        id: `${date}:${generated.category.id}`,
        date,
        category: generated.category,
        answers: resolved.resolution.answers.sort((a, b) => a.rank - b.rank),
        sources: resolved.resolution.sources,
        sourceUrl: resolved.resolution.sources[0] ?? "",
        generatedAt: new Date().toISOString(),
        confidence: resolved.resolution.confidence,
        validation: {
          valid: false,
          checks: {
            rankedPrompt: false,
            exactlyTenAnswers: false,
            uniqueAnswers: false,
            objectiveRanking: resolved.resolution.objectiveRanking,
            safeAliases: false,
            understandableCategory: false,
            reliableSources: resolved.resolution.sourceReliable
          },
          errors: []
        },
        generationMode: generated.mode,
        warning:
          generated.mode === "development-mock"
            ? "OPENAI_API_KEY is missing. Using a deterministic development mock, not live AI generation."
            : undefined,
        rawAIResponse: {
          category: generated.rawAIResponse,
          resolution: resolved.rawResolvedResponse
        }
      };
      provisional.validation = validateTopTenPuzzle(provisional);
      provisional.validation.checks.objectiveRanking = resolved.resolution.objectiveRanking;
      provisional.validation.checks.reliableSources = resolved.resolution.sourceReliable;
      provisional.validation.errors = Object.entries(provisional.validation.checks)
        .filter(([, passed]) => !passed)
        .map(([check]) => `Validation failed: ${check}`);
      provisional.validation.valid = provisional.validation.errors.length === 0;
      if (!provisional.validation.valid) {
        throw new Error(provisional.validation.errors.join("; ") || "AI validation failed.");
      }
      if (!options.force) dailyCache.set(date, provisional);
      return provisional;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown generation error";
      failures.push(message);
      console.error("[Top 10 generation attempt failed]", {
        date,
        attempt,
        mode: getTopTenProviderStatus().mode,
        model: getTopTenProviderStatus().model,
        error: message
      });
    }
  }
  console.error("[Top 10 unavailable]", {
    date,
    mode: getTopTenProviderStatus().mode,
    failures
  });
  throw new Error(
    `Today’s Top 10 could not be generated. Please try again later. ${failures.join(" | ")}`
  );
}

export function getAvailableTopTenCategories() {
  return process.env.OPENAI_API_KEY
    ? TOPIC_AREAS.map((topicArea) => ({ topicArea, mode: "AI generated" }))
    : MOCK_CATEGORIES.map((entry) => entry.category);
}

export function getTopTenProviderStatus() {
  return {
    mode: process.env.OPENAI_API_KEY ? "live-ai" : "development-mock",
    model: process.env.OPENAI_MODEL ?? "gpt-5.5",
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
    warning: process.env.OPENAI_API_KEY
      ? null
      : "OPENAI_API_KEY is missing. Top 10 is using the clearly labeled development mock generator."
  };
}

function category(
  id: string,
  title: string,
  prompt: string,
  topicArea: string,
  rankingMetric: string,
  expectedAnswerType: string
): TopTenCategory {
  return {
    id,
    title,
    displayName: title,
    prompt,
    topicArea,
    rankingMetric,
    expectedAnswerType,
    answerType: expectedAnswerType,
    sourceStrategy: "Verified local development fixture",
    source: "Development mock fixture",
    aliasStrategy: "Curated common aliases",
    difficulty: "medium",
    safetyRating: "safe"
  };
}

function answers(items: Array<[string, string, string[]?]>): TopTenAnswer[] {
  return items.map(([name, value, aliases = []], index) => ({
    rank: index + 1,
    name,
    aliases,
    value,
    sourceNote: "Development mock fixture"
  }));
}

const MOCK_CATEGORIES: Array<{
  category: TopTenCategory;
  answers: TopTenAnswer[];
  sources: string[];
}> = [
  {
    category: category("largest-countries-area", "Largest Countries", "Name the top 10 countries by total area.", "Geography", "total area", "country"),
    answers: answers([
      ["Russia", "17.1M km²", ["Russian Federation"]], ["Canada", "10.0M km²"], ["China", "9.6M km²", ["PRC"]],
      ["United States", "9.5M km²", ["USA", "US", "United States of America"]], ["Brazil", "8.5M km²"],
      ["Australia", "7.7M km²"], ["India", "3.3M km²"], ["Argentina", "2.8M km²"],
      ["Kazakhstan", "2.7M km²"], ["Algeria", "2.4M km²"]
    ]),
    sources: ["https://data.worldbank.org/indicator/AG.SRF.TOTL.K2"]
  },
  {
    category: category("tallest-mountains", "Earth’s Tallest Mountains", "Name the top 10 highest mountains above sea level.", "World records", "elevation above sea level", "mountain"),
    answers: answers([
      ["Mount Everest", "8,848.86 m", ["Everest"]], ["K2", "8,611 m", ["Mount Godwin-Austen"]],
      ["Kangchenjunga", "8,586 m", ["Kanchenjunga"]], ["Lhotse", "8,516 m"], ["Makalu", "8,485 m"],
      ["Cho Oyu", "8,188 m"], ["Dhaulagiri I", "8,167 m", ["Dhaulagiri"]], ["Manaslu", "8,163 m"],
      ["Nanga Parbat", "8,126 m"], ["Annapurna I", "8,091 m", ["Annapurna"]]
    ]),
    sources: ["https://www.britannica.com/science/mountain-landform"]
  },
  {
    category: category("largest-islands", "Largest Islands", "Name the top 10 largest islands by land area, excluding continents.", "Geography", "land area", "island"),
    answers: answers([
      ["Greenland", "2,130,800 km²"], ["New Guinea", "785,753 km²"], ["Borneo", "748,168 km²"],
      ["Madagascar", "587,041 km²"], ["Baffin Island", "507,451 km²"], ["Sumatra", "443,066 km²"],
      ["Honshu", "225,800 km²"], ["Victoria Island", "217,291 km²"], ["Great Britain", "209,331 km²", ["Britain"]],
      ["Ellesmere Island", "196,236 km²"]
    ]),
    sources: ["https://www.britannica.com/science/island"]
  },
  {
    category: category("largest-moons", "Largest Moons", "Name the top 10 largest moons in the Solar System by diameter.", "Science", "mean diameter", "moon"),
    answers: answers([
      ["Ganymede", "5,268 km"], ["Titan", "5,150 km"], ["Callisto", "4,821 km"], ["Io", "3,643 km"],
      ["Moon", "3,475 km", ["Earth's Moon", "Luna"]], ["Europa", "3,122 km"], ["Triton", "2,707 km"],
      ["Titania", "1,578 km"], ["Rhea", "1,528 km"], ["Oberon", "1,523 km"]
    ]),
    sources: ["https://science.nasa.gov/solar-system/moons/"]
  },
  {
    category: category("best-selling-consoles", "Best-Selling Consoles", "Name the top 10 best-selling video game consoles by worldwide unit sales.", "Video games", "worldwide hardware unit sales", "console"),
    answers: answers([
      ["PlayStation 2", "160M+", ["PS2"]], ["Nintendo DS", "154M", ["DS"]], ["Nintendo Switch", "150M+", ["Switch"]],
      ["Game Boy", "118M", ["Game Boy Color", "GB"]], ["PlayStation 4", "117M", ["PS4"]], ["PlayStation", "102M", ["PS1"]],
      ["Wii", "101M", ["Nintendo Wii"]], ["PlayStation 3", "87M", ["PS3"]], ["Xbox 360", "84M", ["360"]],
      ["Game Boy Advance", "81M", ["GBA"]]
    ]),
    sources: ["https://www.nintendo.co.jp/ir/en/finance/hard_soft/", "https://sonyinteractive.com/"]
  },
  {
    category: category("largest-lakes", "Largest Lakes", "Name the top 10 largest lakes by surface area.", "Geography", "surface area", "lake"),
    answers: answers([
      ["Caspian Sea", "371,000 km²", ["Caspian"]], ["Lake Superior", "82,100 km²", ["Superior"]],
      ["Lake Victoria", "68,870 km²", ["Victoria"]], ["Lake Huron", "59,600 km²", ["Huron"]],
      ["Lake Michigan", "58,000 km²", ["Michigan"]], ["Lake Tanganyika", "32,900 km²", ["Tanganyika"]],
      ["Lake Baikal", "31,500 km²", ["Baikal"]], ["Great Bear Lake", "31,153 km²"],
      ["Lake Malawi", "29,600 km²", ["Lake Nyasa", "Malawi"]], ["Great Slave Lake", "27,200 km²"]
    ]),
    sources: ["https://www.britannica.com/science/lake"]
  },
  {
    category: category("largest-animals", "Largest Living Animals", "Name the top 10 largest living animal species by typical maximum mass.", "Animals", "typical maximum body mass", "animal species"),
    answers: answers([
      ["Blue whale", "180+ tonnes"], ["North Pacific right whale", "100+ tonnes", ["Right whale"]],
      ["Southern right whale", "90+ tonnes"], ["Fin whale", "80+ tonnes"], ["Bowhead whale", "75+ tonnes"],
      ["Humpback whale", "40+ tonnes"], ["Sperm whale", "40+ tonnes"], ["Whale shark", "20+ tonnes"],
      ["African bush elephant", "10+ tonnes", ["African elephant"]], ["Basking shark", "7+ tonnes"]
    ]),
    sources: ["https://www.britannica.com/animal/blue-whale"]
  }
];

function mockCategoryForDate(date: string, attempt: number) {
  const dayNumber = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);
  const offset = hashString("minefield-mock-cycle") % MOCK_CATEGORIES.length;
  return MOCK_CATEGORIES[(dayNumber + offset + attempt * 3) % MOCK_CATEGORIES.length];
}
