import { generateContentHash } from "@/lib/content/repeatPrevention";
import { hashString } from "@/lib/dailySeed";
import type { GeneratedContentEnvelope } from "@/lib/content/dailyContentEngine";
import type { ValidationResult } from "@/lib/content/validation";

export const DAILY_GENERATION_TEMPERATURE = 0;

export function deterministicEnvelope<T>({
  gameId,
  date,
  puzzle,
  validation,
  topic,
  answer,
  sourceNotes
}: {
  gameId: string;
  date: string;
  puzzle: T;
  validation: ValidationResult;
  topic: string;
  answer: string;
  sourceNotes: string[];
}): GeneratedContentEnvelope<T> {
  const seed = hashString(`${gameId}:${date}:0`);
  return {
    puzzle,
    date,
    seed,
    generator: "Versioned deterministic daily catalog",
    rawAIResponse: null,
    validation,
    confidence: 1,
    sourceNotes,
    contentHash: generateContentHash({ gameId, date, puzzle }),
    repeatCheck: { repeated: false, lookback: 45 },
    generatedAt: `${date}T12:00:00.000Z`,
    warnings: [],
    cacheHit: true,
    generationDurationMs: 0
  };
}
