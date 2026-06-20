import { getCachedContent, cacheContent, clearCachedContent } from "@/lib/content/cache";
import { generateContentHash, hasRecentlyAppeared, markContentUsed } from "@/lib/content/repeatPrevention";
import type { ValidationResult } from "@/lib/content/validation";
import { hashString } from "@/lib/dailySeed";

export type GeneratedContentEnvelope<T> = {
  puzzle: T;
  date: string;
  seed: number;
  generator: string;
  rawAIResponse: unknown;
  validation: ValidationResult;
  confidence: number;
  sourceNotes: string[];
  contentHash: string;
  repeatCheck: { repeated: boolean; lookback: number };
  generatedAt: string;
  warnings: string[];
};

export async function generateDailyContent<T>({
  gameId,
  date,
  force = false,
  attempts = 3,
  generate,
  validate,
  describe
}: {
  gameId: string;
  date: string;
  force?: boolean;
  attempts?: number;
  generate: (context: { date: string; seed: number; attempt: number }) => Promise<{
    puzzle: T;
    rawAIResponse: unknown;
    confidence: number;
    sourceNotes: string[];
    generator?: string;
  }>;
  validate: (puzzle: T) => ValidationResult;
  describe: (puzzle: T) => { topic: string; answer: string; hashInput?: unknown };
}) {
  const cacheKey = `${gameId}:${date}`;
  if (!force) {
    const cached = getCachedContent<GeneratedContentEnvelope<T>>(cacheKey);
    if (cached) return cached;
  } else {
    clearCachedContent(cacheKey);
  }

  const failures: string[] = [];
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const seed = hashString(`${gameId}:${date}:${attempt}`);
    try {
      const generated = await generate({ date, seed, attempt });
      const validation = validate(generated.puzzle);
      if (!validation.valid) throw new Error(validation.errors.join("; "));
      const description = describe(generated.puzzle);
      const contentHash = generateContentHash(description.hashInput ?? generated.puzzle);
      const repeated = hasRecentlyAppeared(gameId, contentHash);
      if (repeated && attempt < attempts - 1) throw new Error("Generated content appeared recently.");
      const envelope: GeneratedContentEnvelope<T> = {
        puzzle: generated.puzzle,
        date,
        seed,
        generator: generated.generator ?? "OpenAI Responses API",
        rawAIResponse: generated.rawAIResponse,
        validation,
        confidence: generated.confidence,
        sourceNotes: generated.sourceNotes,
        contentHash,
        repeatCheck: { repeated, lookback: 45 },
        generatedAt: new Date().toISOString(),
        warnings: repeated ? ["Content matched recent history after all retries."] : []
      };
      markContentUsed({
        gameId,
        contentHash,
        topic: description.topic,
        answer: description.answer,
        date
      });
      return cacheContent(cacheKey, envelope);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Unknown generation error");
    }
  }
  throw new Error(failures.join(" | ") || `${gameId} generation failed.`);
}
