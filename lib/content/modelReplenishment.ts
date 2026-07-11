import "server-only";

import { requestStructuredContent } from "@/lib/content/aiClient";
import { validateBuzzwordCandidate, validateNumericCandidate, validateObjectiveOrdering, type BuzzwordCandidate, type InOrderCandidate, type NumericCandidate } from "@/lib/content/preparedInventories";
import { savePersistedCandidates, type PersistedCandidate } from "@/lib/content/persistence";
import { createUniqueContentKey, normalizeUsedContentText } from "@/lib/content/usedContentRegistry";

const string = { type: "string" } as const;
const batchSchema = (item: Record<string, unknown>) => ({
  type: "object", additionalProperties: false, required: ["candidates"],
  properties: { candidates: { type: "array", minItems: 12, maxItems: 25, items: item } }
});

const buzzwordSchema = batchSchema({
  type: "object", additionalProperties: false,
  required: ["word", "definition", "commonMisspellings", "pronunciationHint", "difficulty"],
  properties: {
    word: string, definition: string,
    commonMisspellings: { type: "array", minItems: 2, maxItems: 5, items: string },
    pronunciationHint: string,
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] }
  }
});

const numericSchema = batchSchema({
  type: "object", additionalProperties: false,
  required: ["id", "category", "topic", "prompt", "answer", "unit", "displayAnswer", "acceptableRangeNote", "sourceNote", "difficulty"],
  properties: {
    id: string, category: string, topic: string, prompt: string, answer: { type: "number" }, unit: string,
    displayAnswer: string, acceptableRangeNote: string, sourceNote: string,
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] }
  }
});

const orderSchema = batchSchema({
  type: "object", additionalProperties: false,
  required: ["id", "title", "playerPrompt", "category", "metric", "semanticTopic", "items", "source", "difficulty"],
  properties: {
    id: string, title: string, playerPrompt: string, category: string, metric: string, semanticTopic: string,
    items: { type: "array", minItems: 5, maxItems: 5, items: { type: "object", additionalProperties: false, required: ["name", "value", "displayValue"], properties: { name: string, value: { type: "number" }, displayValue: string } } },
    source: string,
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] }
  }
});

function persisted<T>({ gameId, candidateId, payload, keys, source, difficulty, category }: { gameId: string; candidateId: string; payload: T; keys: string[]; source: string; difficulty: string; category: string }): PersistedCandidate<T> {
  const now = new Date().toISOString();
  return { gameId, candidateId, payload, normalizedContentKeys: keys, validationStatus: "validated", validationVersion: "inventory-v3", sourceMetadata: { source, generatedBy: "configured OpenAI model; deterministic validator accepted" }, createdAt: now, lastValidatedAt: now, qualityScore: 0.8, difficulty, category };
}

export async function replenishModelCandidates(gameId: "spelldrop" | "closer" | "ranked-top-5", seed: string) {
  if (gameId === "spelldrop") {
    const result = await requestStructuredContent<{ candidates: Array<Omit<BuzzwordCandidate, "id" | "frequencyRank" | "sourceNote" | "validationVersion">> }>({
      name: "minefield_buzzword_inventory_batch", schema: buzzwordSchema,
      instructions: "Generate a diverse batch of familiar but genuinely tricky-to-spell English words. Return dictionary-quality definitions, useful plain-English pronunciation hints, and plausible common misspellings. Exclude proper nouns, offensive terms, trivial words, technical jargon, homophone traps, and duplicates within the batch.",
      input: `Inventory replenishment seed ${seed}. Vary word length, orthographic pattern, and difficulty. Return 25 candidates.`
    });
    const candidates: BuzzwordCandidate[] = result.parsed.candidates.map((item, index) => ({ ...item, id: `model-${normalizeUsedContentText(item.word)}`, frequencyRank: 99_000 + index, sourceNote: `OpenAI structured lexical ideation (${result.model}); deterministic lexical validation`, validationVersion: "buzzword-v3" }));
    const valid = candidates.filter(validateBuzzwordCandidate);
    const records = valid.map((item) => persisted({ gameId, candidateId: item.id, payload: item, keys: [createUniqueContentKey("spelldrop", "word", [item.word]), createUniqueContentKey("spelldrop", "definition", [item.definition])], source: item.sourceNote, difficulty: item.difficulty, category: "vocabulary" }));
    const saved = await savePersistedCandidates(gameId, records);
    return { gameId, generated: candidates.length, validated: valid.length, rejected: candidates.length - valid.length, apiCalls: 1, ...saved };
  }

  if (gameId === "closer") {
    const result = await requestStructuredContent<{ candidates: Array<Omit<NumericCandidate, "alternateUnits" | "verifiedAt">> }>({
      name: "minefield_ballpark_inventory_batch", schema: numericSchema, useWebSearch: true,
      instructions: "Generate a diverse batch of stable, mainstream numeric trivia questions. Verify every value using a reliable source URL. Include a snapshot date for fluctuating values. Reject vague, disputed, unit-ambiguous, near-duplicate, and hyper-specific facts. Cover geography, astronomy, animals, body, architecture, transport, history, entertainment, sports, technology, economics, nature, and food.",
      input: `Inventory replenishment seed ${seed}. Return 20 independently sourced candidates with varied answers and categories.`
    });
    const now = new Date().toISOString();
    const candidates: NumericCandidate[] = result.parsed.candidates.map((item) => ({ ...item, alternateUnits: [], verifiedAt: now }));
    const valid = candidates.filter(validateNumericCandidate);
    const records = valid.map((item) => persisted({ gameId, candidateId: item.id, payload: item, keys: [createUniqueContentKey("closer", "question-answer", [item.prompt, item.answer, item.unit]), createUniqueContentKey("closer", "answer-topic", [item.topic, item.answer, item.unit])], source: item.sourceNote, difficulty: item.difficulty, category: item.category }));
    const saved = await savePersistedCandidates(gameId, records);
    return { gameId, generated: candidates.length, validated: valid.length, rejected: candidates.length - valid.length, apiCalls: 1, ...saved };
  }

  const result = await requestStructuredContent<{ candidates: Array<Omit<InOrderCandidate, "items" | "numericValues"> & { items: Array<{ name: string; value: number; displayValue: string }> }> }>({
    name: "minefield_in_order_inventory_batch", schema: orderSchema, useWebSearch: true,
    instructions: "Generate a diverse batch of general-audience five-item ordering questions with one objective numeric or date ordering. Verify each list using a reliable source URL. Reject ties, ambiguous wording, obscurity, duplicate item sets, and near-duplicate topics within the batch.",
    input: `Inventory replenishment seed ${seed}. Vary across movies, music, geography, landmarks, history, sports, companies, games, television, books, science, measurements, awards, and records. Return 20 candidates.`
  });
  const candidates: InOrderCandidate[] = result.parsed.candidates.map((item) => {
    const sorted = [...item.items].sort((left, right) => right.value - left.value);
    return { ...item, items: sorted.map((entry) => [entry.name, entry.displayValue]), numericValues: sorted.map((entry) => entry.value) };
  });
  const valid = candidates.filter(validateObjectiveOrdering);
  const records = valid.map((item) => persisted({ gameId, candidateId: item.id, payload: item, keys: [createUniqueContentKey("ranked-top-5", "ranking", [item.metric, ...item.items.map(([name]) => name).sort()])], source: item.source, difficulty: item.difficulty, category: item.category }));
  const saved = await savePersistedCandidates(gameId, records);
  return { gameId, generated: candidates.length, validated: valid.length, rejected: candidates.length - valid.length, apiCalls: 1, ...saved };
}
