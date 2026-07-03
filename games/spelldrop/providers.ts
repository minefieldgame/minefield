import { requestStructuredContent } from "@/lib/content/aiClient";
import { generateDailyContent, type GeneratedContentEnvelope } from "@/lib/content/dailyContentEngine";
import { buildValidation, isSafeGeneralAudienceText } from "@/lib/content/validation";
import type { SpellDropPuzzle } from "@/games/spelldrop/types";

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["word", "definition", "commonMisspellings", "difficulty", "pronunciationHint", "confidence"],
  properties: {
    word: { type: "string" },
    definition: { type: "string" },
    commonMisspellings: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 },
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
    pronunciationHint: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 }
  }
} as const;

type GeneratedSpellDrop = Omit<SpellDropPuzzle, "gameId" | "date" | "seed"> & { confidence: number };

export function validateSpellDropPuzzle(puzzle: SpellDropPuzzle) {
  return buildValidation({
    lowercaseWord: /^[a-z]+(?:-[a-z]+)?$/.test(puzzle.word),
    suitableLength: puzzle.word.length >= 5 && puzzle.word.length <= 22,
    definitionPresent: isSafeGeneralAudienceText(puzzle.definition),
    misspellingsPresent: puzzle.commonMisspellings.length >= 2,
    uniqueMisspellings: new Set(puzzle.commonMisspellings.map((word) => word.toLowerCase())).size === puzzle.commonMisspellings.length,
    correctNotInMisspellings: !puzzle.commonMisspellings.some((word) => word.toLowerCase() === puzzle.word.toLowerCase()),
    pronunciationPresent: puzzle.pronunciationHint.trim().length > 0
  });
}

export async function resolveDailySpellDropPuzzle(
  date: string,
  force = false
): Promise<GeneratedContentEnvelope<SpellDropPuzzle>> {
  return generateDailyContent({
    gameId: "spelldrop",
    date,
    force,
    generate: async ({ seed }) => {
      const result = await requestStructuredContent<GeneratedSpellDrop>({
        name: "minefield_spelldrop",
        instructions:
          "Choose one real, common, recognizable, commonly misspelled English word for a general audience. Do not repeat any word or near-identical spelling target in USED_CONTENT_KEYS. A repeat includes the same answer word even if the definition or misspellings change. Avoid common default examples when possible. Target the reaction: 'I know this word—wait, how do you spell it?' Favor familiar everyday vocabulary, not obscure academic words. It must not be a proper noun, offensive, ambiguous, or a homophone trap. Include a concise definition, actual common misspellings, and a simple pronunciation hint. Return only the schema.",
        input: `Pacific date ${date}; deterministic seed ${seed}. Generate fresh easy-to-medium content suitable for a quick daily game. USED_CONTENT_KEYS are supplied by the app when persistence is enabled; generate content that avoids all prior words.`,
        schema: SCHEMA
      });
      const { confidence, ...content } = result.parsed;
      return {
        puzzle: { gameId: "spelldrop", date, seed, ...content, word: content.word.toLowerCase() },
        rawAIResponse: result.raw,
        confidence,
        sourceNotes: ["OpenAI structured generation with lexical safety validation"],
        generator: `OpenAI Responses API (${result.model})`
      };
    },
    validate: validateSpellDropPuzzle,
    describe: (puzzle) => ({ topic: "commonly misspelled English words", answer: puzzle.word, hashInput: puzzle.word })
  });
}

export const resolveSpellDropForDate = resolveDailySpellDropPuzzle;


