import buzzwordData from "@/data/generated/buzzwords.json";
import countryFactData from "@/data/generated/countryFacts.json";
import manifestData from "@/data/generated/manifest.json";
import {
  BALLPARK_CATEGORIES,
  IN_ORDER_CATEGORY_FAMILIES,
  ORDER_BALLPARK_REFERENCE_COLLECTIONS,
  type BallparkCategory,
  type InOrderCategoryFamily,
  type ReferenceCollection,
  type ReferenceDifficulty,
  type ReferenceFact
} from "@/data/orderBallparkReferences";
import { hashString } from "@/lib/dailySeed";
import { buildQualityEvaluation, type QualityEvaluation } from "@/lib/content/quality";
import { createUniqueContentKey } from "@/lib/content/usedContentRegistry";

export type BuzzwordCandidate = {
  id: string;
  word: string;
  definition: string;
  commonMisspellings: string[];
  pronunciationHint: string;
  difficulty: "easy" | "medium" | "hard";
  frequencyRank: number;
  sourceNote: string;
  validationVersion: string;
  misspellingEvidence: Array<{ value: string; rule: string; score: number }>;
  misspellingPlausibilityScore: number;
  pronunciationValid: boolean;
  misspellingValid: boolean;
  qualityScore: number;
};

export type CountryFact = {
  id: string;
  name: string;
  population: number;
  area: number;
  borders: number;
  languages: number;
  capitals: number;
  timezones: number;
  currencies: number;
  callingCode: number | null;
  latitude: number;
  longitude: number;
  landlocked: boolean;
  region: string;
  subregion: string;
  snapshotDate: string;
  sourceNote: string;
};

export type BallparkQualityDimensions = {
  recognizability: number;
  intuitiveEstimability: number;
  entertainmentValue: number;
  wordingClarity: number;
  answerStability: number;
  unitFamiliarity: number;
  categoryFreshness: number;
  difficultyFit: number;
};

export type NumericCandidate = {
  id: string;
  category: BallparkCategory;
  topic: string;
  prompt: string;
  answer: number;
  unit: string;
  alternateUnits: Array<{ unit: string; multiplier: number }>;
  displayAnswer: string;
  acceptableRangeNote: string;
  sourceNote: string;
  sourceSnapshot: string;
  sourceCollectionId: string;
  verifiedAt: string;
  difficulty: "easy" | "medium" | "hard";
  difficultyTier: ReferenceDifficulty;
  qualityDimensions: BallparkQualityDimensions;
  qualityScore: number;
  qualityApproved: boolean;
  quality: QualityEvaluation;
  validationVersion: string;
};

export type InOrderCandidate = {
  id: string;
  title: string;
  playerPrompt: string;
  category: string;
  categoryFamily: InOrderCategoryFamily;
  metric: string;
  semanticTopic: string;
  direction: "highest-to-lowest" | "lowest-to-highest";
  items: Array<[string, string]>;
  numericValues: number[];
  source: string;
  sourceSnapshot: string;
  sourceCollectionId: string;
  difficulty: "easy" | "medium" | "hard";
  difficultyTier: ReferenceDifficulty;
  familiarityScore: number;
  recognizableAnchorCount: number;
  qualityScore: number;
  qualityApproved: boolean;
  quality: QualityEvaluation;
  validationVersion: string;
};

export type InventoryDistributionValidation = {
  valid: boolean;
  errors: string[];
  counts: Record<string, number>;
};

export const BUZZWORD_CANDIDATES = buzzwordData as BuzzwordCandidate[];
export const COUNTRY_FACTS = countryFactData as CountryFact[];
export const PREPARED_INVENTORY_MANIFEST = manifestData;

const VERIFIED_AT = "2026-07-12T00:00:00.000Z";
const QUALITY_VERSION = "prepared-quality-v4";
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const FORBIDDEN_PLAYER_LANGUAGE = /\b(?:snapshot|structured[- ]data|indicator codes?|validation(?:-version)?|provider names?|database|data engineering|api response|source metadata)\b/i;
const ARBITRARY_NUMERIC_METRIC = /\b(?:population density|ratio|per capita|people per square (?:mile|kilometer|metre|meter))\b/i;

function legacyDifficulty(tier: ReferenceDifficulty): "easy" | "medium" | "hard" {
  return tier === "approachable" ? "easy" : tier === "standard" ? "medium" : "hard";
}

function difficultyFit(tier: ReferenceDifficulty) {
  return tier === "approachable" ? 94 : tier === "standard" ? 86 : 76;
}

function average(values: number[]) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length));
}

function formatSource(collection: ReferenceCollection) {
  return `${collection.sourceUrl} - ${collection.sourceLabel}; ${collection.sourceSnapshot}`;
}

function promptFor(collection: ReferenceCollection, fact: ReferenceFact) {
  return fact.ballparkPrompt ?? collection.ballparkPromptTemplate.replace("{name}", fact.label);
}

function countryCollection({
  id,
  names,
  metric,
  unit,
  promptTemplate,
  orderPrompt,
  title,
  getValue,
  sourceSnapshot
}: {
  id: string;
  names: string[];
  metric: string;
  unit: string;
  promptTemplate: string;
  orderPrompt: string;
  title: string;
  getValue: (country: CountryFact) => number;
  sourceSnapshot: string;
}): ReferenceCollection {
  const byName = new Map(COUNTRY_FACTS.map((country) => [country.name, country]));
  const rows = names.map((name) => byName.get(name)).filter((country): country is CountryFact => Boolean(country));
  if (rows.length !== names.length) throw new Error(`Country reference collection ${id} is missing a requested country.`);
  return {
    id,
    ballparkCategory: "Geography",
    unit,
    ballparkPromptTemplate: promptTemplate,
    sourceUrl: metric === "population" ? "https://data.worldbank.org/indicator/SP.POP.TOTL" : "https://restcountries.com/",
    sourceLabel: metric === "population" ? "World Bank population indicator SP.POP.TOTL" : "REST Countries area reference",
    sourceSnapshot,
    factualConfidence: 96,
    sourceQuality: 96,
    intuitiveEstimability: metric === "population" ? 92 : 86,
    entertainmentValue: 84,
    wordingClarity: 96,
    answerStability: metric === "population" ? 82 : 98,
    unitFamiliarity: 94,
    categoryFreshness: 78,
    difficultyTier: "approachable",
    order: {
      categoryFamily: "mainstream-country-city-facts",
      categoryLabel: "Geography",
      title,
      playerPrompt: orderPrompt,
      metric,
      direction: "highest-to-lowest"
    },
    facts: rows.map((country, index) => {
      const value = getValue(country);
      return {
        id: `${country.id.toLowerCase()}-${metric}`,
        label: country.name,
        value,
        displayValue: `${number.format(value)} ${unit}`,
        familiarity: Math.max(88, 99 - index)
      };
    })
  };
}

const COUNTRY_REFERENCE_COLLECTIONS: ReferenceCollection[] = [
  countryCollection({
    id: "mainstream-country-populations",
    names: ["India", "China", "United States", "Indonesia", "Pakistan", "Nigeria", "Brazil", "Bangladesh", "Russia", "Mexico"],
    metric: "2024 population", unit: "people",
    promptTemplate: "About how many people live in {name}?",
    orderPrompt: "Rank these countries by population, largest to smallest.",
    title: "Mainstream countries by population",
    getValue: (country) => country.population,
    sourceSnapshot: "World Bank 2024 population values; retrieved 2026-07-11"
  }),
  countryCollection({
    id: "mainstream-country-areas",
    names: ["Russia", "Canada", "China", "United States", "Brazil", "Australia", "India", "Argentina", "Kazakhstan", "Algeria"],
    metric: "total area", unit: "square kilometers",
    promptTemplate: "About how large is {name}, in square kilometers?",
    orderPrompt: "Rank these countries by total area, largest to smallest.",
    title: "Mainstream countries by area",
    getValue: (country) => country.area,
    sourceSnapshot: "REST Countries area values; retrieved 2026-07-11"
  })
];

const REFERENCE_COLLECTIONS = [...ORDER_BALLPARK_REFERENCE_COLLECTIONS, ...COUNTRY_REFERENCE_COLLECTIONS];
const REFERENCE_COLLECTION_BY_ID = new Map(REFERENCE_COLLECTIONS.map((collection) => [collection.id, collection]));
const REFERENCE_FACT_BY_TOPIC = new Map(REFERENCE_COLLECTIONS.flatMap((collection) =>
  collection.facts.map((fact) => [`${collection.id}:${fact.id}`, { collection, fact }] as const)
));

function ballparkQuality(collection: ReferenceCollection, fact: ReferenceFact) {
  const dimensions: BallparkQualityDimensions = {
    recognizability: fact.familiarity,
    intuitiveEstimability: collection.intuitiveEstimability,
    entertainmentValue: collection.entertainmentValue,
    wordingClarity: collection.wordingClarity,
    answerStability: collection.answerStability,
    unitFamiliarity: collection.unitFamiliarity,
    categoryFreshness: collection.categoryFreshness,
    difficultyFit: difficultyFit(collection.difficultyTier)
  };
  const qualityScore = average(Object.values(dimensions));
  const quality = buildQualityEvaluation({
    factualConfidence: collection.factualConfidence,
    recognizability: fact.familiarity,
    clarity: collection.wordingClarity,
    fairness: average([collection.intuitiveEstimability, collection.answerStability, collection.unitFamiliarity]),
    entertainmentValue: collection.entertainmentValue,
    difficulty: collection.difficultyTier,
    sourceQuality: collection.sourceQuality,
    rejectionReasons: [],
    minimumScore: 70,
    evaluationMethod: "source-backed",
    evaluationVersion: QUALITY_VERSION
  });
  return { dimensions, qualityScore, quality, qualityApproved: qualityScore >= 72 && quality.finalEligibility };
}

export function buildNumericCandidates(): NumericCandidate[] {
  const candidates = REFERENCE_COLLECTIONS.flatMap((collection) => collection.facts.map((fact) => {
    const unit = fact.unit ?? collection.unit;
    const { dimensions, qualityScore, quality, qualityApproved } = ballparkQuality(collection, fact);
    return {
      id: `reference-${collection.id}-${fact.id}`,
      category: collection.ballparkCategory,
      topic: `${collection.id}:${fact.id}`,
      prompt: promptFor(collection, fact),
      answer: fact.value,
      unit,
      alternateUnits: [],
      displayAnswer: fact.displayValue,
      acceptableRangeNote: collection.sourceSnapshot,
      sourceNote: formatSource(collection),
      sourceSnapshot: collection.sourceSnapshot,
      sourceCollectionId: collection.id,
      verifiedAt: VERIFIED_AT,
      difficulty: legacyDifficulty(collection.difficultyTier),
      difficultyTier: collection.difficultyTier,
      qualityDimensions: dimensions,
      qualityScore,
      qualityApproved,
      quality,
      validationVersion: QUALITY_VERSION
    } satisfies NumericCandidate;
  }));
  return candidates.filter(validateNumericCandidate);
}

function deterministicIndexes(seed: string, count: number, limit: number) {
  const values: number[] = [];
  let cursor = hashString(seed);
  while (values.length < count) {
    cursor = hashString(`${seed}:${cursor}:${values.length}`);
    const index = cursor % limit;
    if (!values.includes(index)) values.push(index);
  }
  return values;
}

function inOrderQuality(collection: ReferenceCollection, picked: ReferenceFact[]) {
  const familiarityScore = average(picked.map((fact) => fact.familiarity));
  const recognizableAnchorCount = picked.filter((fact) => fact.familiarity >= 90).length;
  const quality = buildQualityEvaluation({
    factualConfidence: collection.factualConfidence,
    recognizability: familiarityScore,
    clarity: collection.wordingClarity,
    fairness: average([collection.answerStability, collection.unitFamiliarity, familiarityScore]),
    entertainmentValue: collection.entertainmentValue,
    difficulty: collection.difficultyTier,
    sourceQuality: collection.sourceQuality,
    rejectionReasons: recognizableAnchorCount < 1 ? ["No mainstream anchor"] : [],
    minimumScore: 72,
    evaluationMethod: "source-backed",
    evaluationVersion: QUALITY_VERSION
  });
  const qualityScore = quality.overallScore;
  return {
    familiarityScore,
    recognizableAnchorCount,
    quality,
    qualityScore,
    qualityApproved: familiarityScore >= 78 && recognizableAnchorCount >= 1 && qualityScore >= 72 && quality.finalEligibility
  };
}

function inOrderCandidate(collection: ReferenceCollection, pickedFacts: ReferenceFact[], identity: string): InOrderCandidate | null {
  const order = collection.order;
  if (!order) return null;
  const picked = [...pickedFacts].sort((left, right) => order.direction === "highest-to-lowest"
    ? right.value - left.value
    : left.value - right.value);
  if (new Set(picked.map((fact) => fact.value)).size !== 5) return null;
  const qualityResult = inOrderQuality(collection, picked);
  const candidate: InOrderCandidate = {
    id: `${collection.id}-${identity}`,
    title: order.title,
    playerPrompt: order.playerPrompt,
    category: order.categoryLabel,
    categoryFamily: order.categoryFamily,
    metric: order.metric,
    semanticTopic: collection.id,
    direction: order.direction,
    items: picked.map((fact) => [fact.label, fact.displayValue]),
    numericValues: picked.map((fact) => fact.value),
    source: formatSource(collection),
    sourceSnapshot: collection.sourceSnapshot,
    sourceCollectionId: collection.id,
    difficulty: legacyDifficulty(collection.difficultyTier),
    difficultyTier: collection.difficultyTier,
    familiarityScore: qualityResult.familiarityScore,
    recognizableAnchorCount: qualityResult.recognizableAnchorCount,
    qualityScore: qualityResult.qualityScore,
    qualityApproved: qualityResult.qualityApproved,
    quality: qualityResult.quality,
    validationVersion: QUALITY_VERSION
  };
  return validateObjectiveOrdering(candidate) ? candidate : null;
}

export function buildInOrderCandidates(target = 600): InOrderCandidate[] {
  const eligibleCollections = REFERENCE_COLLECTIONS.filter((collection) => Boolean(collection.order));
  const candidates: InOrderCandidate[] = [];
  const seen = new Set<string>();
  for (let round = 0; candidates.length < target && round < 500; round += 1) {
    for (const collection of eligibleCollections) {
      const indexes = deterministicIndexes(`${collection.id}:${round}`, 5, collection.facts.length);
      const picked = indexes.map((index) => collection.facts[index]);
      const identity = picked.map((fact) => fact.id).sort().join("-");
      const exactSetIdentity = createUniqueContentKey("ranked-top-5", "ranking", [
        collection.order?.metric ?? "",
        collection.order?.direction ?? "",
        picked.map((fact) => fact.label).sort().join("|")
      ]);
      if (seen.has(exactSetIdentity)) continue;
      const candidate = inOrderCandidate(collection, picked, identity);
      if (!candidate) continue;
      seen.add(exactSetIdentity);
      candidates.push(candidate);
      if (candidates.length >= target) break;
    }
  }
  if (candidates.length < target) throw new Error(`Only ${candidates.length} quality-approved In Order candidates could be prepared.`);
  return candidates;
}

function scoresAreValid(scores: number[]) {
  return scores.every((score) => Number.isFinite(score) && score >= 0 && score <= 100);
}

export function validateObjectiveOrdering(candidate: InOrderCandidate) {
  if (!candidate || !Array.isArray(candidate.items) || !Array.isArray(candidate.numericValues) ||
      !candidate.quality || typeof candidate.quality !== "object" ||
      !Array.isArray(candidate.quality.rejectionReasons) ||
      typeof candidate.playerPrompt !== "string" || typeof candidate.source !== "string" ||
      typeof candidate.sourceSnapshot !== "string" ||
      !candidate.items.every((item) => Array.isArray(item) && typeof item[0] === "string" && typeof item[1] === "string")) return false;
  const referenceCollection = REFERENCE_COLLECTION_BY_ID.get(candidate.sourceCollectionId);
  const referenceOrder = referenceCollection?.order;
  if (!referenceCollection || !referenceOrder || candidate.semanticTopic !== referenceCollection.id ||
      candidate.categoryFamily !== referenceOrder.categoryFamily || candidate.category !== referenceOrder.categoryLabel ||
      candidate.metric !== referenceOrder.metric || candidate.direction !== referenceOrder.direction ||
      candidate.playerPrompt !== referenceOrder.playerPrompt || candidate.source !== formatSource(referenceCollection) ||
      candidate.sourceSnapshot !== referenceCollection.sourceSnapshot) return false;
  const referenceByLabel = new Map(referenceCollection.facts.map((fact) => [fact.label, fact]));
  const selectedReferenceFacts: ReferenceFact[] = [];
  if (!candidate.items.every(([name, displayValue], index) => {
    const fact = referenceByLabel.get(name);
    if (!fact || fact.displayValue !== displayValue || fact.value !== candidate.numericValues[index]) return false;
    selectedReferenceFacts.push(fact);
    return true;
  })) return false;
  const expectedQuality = inOrderQuality(referenceCollection, selectedReferenceFacts);
  if (candidate.familiarityScore !== expectedQuality.familiarityScore ||
      candidate.recognizableAnchorCount !== expectedQuality.recognizableAnchorCount ||
      candidate.qualityScore !== expectedQuality.qualityScore || candidate.qualityApproved !== expectedQuality.qualityApproved ||
      candidate.quality.overallScore !== expectedQuality.quality.overallScore ||
      candidate.quality.evaluationVersion !== expectedQuality.quality.evaluationVersion) return false;
  const names = candidate.items.map(([name]) => name.trim().toLowerCase());
  const strictDirection = candidate.numericValues.every((value, index, values) => index === 0 || (
    candidate.direction === "highest-to-lowest" ? values[index - 1] > value : values[index - 1] < value
  ));
  const directionLanguage = candidate.direction === "highest-to-lowest"
    ? /\b(?:highest to lowest|largest to smallest|tallest to shortest|longest to shortest|fastest to slowest|farthest to nearest|widest to narrowest|heaviest to lightest)\b/i.test(candidate.playerPrompt)
    : /\b(?:earliest to latest|oldest to newest|lowest to highest|smallest to largest|shortest to longest|nearest to farthest)\b/i.test(candidate.playerPrompt);
  return candidate.items.length === 5 &&
    candidate.numericValues.length === 5 &&
    names.every(Boolean) && new Set(names).size === 5 &&
    candidate.items.every(([, displayValue]) => displayValue.trim().length > 0) &&
    new Set(candidate.numericValues).size === 5 &&
    candidate.numericValues.every(Number.isFinite) && strictDirection && directionLanguage &&
    IN_ORDER_CATEGORY_FAMILIES.includes(candidate.categoryFamily) &&
    candidate.playerPrompt.length >= 20 && candidate.playerPrompt.length <= 140 &&
    !FORBIDDEN_PLAYER_LANGUAGE.test(candidate.playerPrompt) &&
    /^https?:\/\//i.test(candidate.source) && Boolean(candidate.sourceSnapshot.trim()) &&
    candidate.familiarityScore >= 78 && candidate.recognizableAnchorCount >= 1 &&
    candidate.qualityScore >= 72 && candidate.qualityApproved && candidate.quality.finalEligibility &&
    candidate.quality.rejectionReasons.length === 0 &&
    scoresAreValid([candidate.familiarityScore, candidate.qualityScore, candidate.quality.overallScore]) &&
    candidate.difficulty === legacyDifficulty(candidate.difficultyTier) &&
    candidate.validationVersion === QUALITY_VERSION;
}

export function validateNumericCandidate(candidate: NumericCandidate) {
  if (!candidate || !candidate.qualityDimensions || typeof candidate.qualityDimensions !== "object" ||
      !candidate.quality || typeof candidate.quality !== "object" ||
      !Array.isArray(candidate.quality.rejectionReasons) ||
      typeof candidate.prompt !== "string" || typeof candidate.topic !== "string" ||
      typeof candidate.unit !== "string" || typeof candidate.displayAnswer !== "string" ||
      typeof candidate.sourceNote !== "string" || typeof candidate.sourceSnapshot !== "string" ||
      typeof candidate.verifiedAt !== "string") return false;
  const reference = REFERENCE_FACT_BY_TOPIC.get(candidate.topic as `${string}:${string}`);
  if (!reference) return false;
  const expectedUnit = reference.fact.unit ?? reference.collection.unit;
  if (candidate.id !== `reference-${reference.collection.id}-${reference.fact.id}` ||
      candidate.sourceCollectionId !== reference.collection.id || candidate.category !== reference.collection.ballparkCategory ||
      candidate.prompt !== promptFor(reference.collection, reference.fact) || candidate.answer !== reference.fact.value ||
      candidate.unit !== expectedUnit || candidate.displayAnswer !== reference.fact.displayValue ||
      candidate.sourceNote !== formatSource(reference.collection) || candidate.sourceSnapshot !== reference.collection.sourceSnapshot) return false;
  const expectedQuality = ballparkQuality(reference.collection, reference.fact);
  if (candidate.qualityScore !== expectedQuality.qualityScore || candidate.qualityApproved !== expectedQuality.qualityApproved ||
      candidate.quality.overallScore !== expectedQuality.quality.overallScore ||
      candidate.quality.evaluationVersion !== expectedQuality.quality.evaluationVersion ||
      !Object.entries(expectedQuality.dimensions).every(([key, value]) => candidate.qualityDimensions[key as keyof BallparkQualityDimensions] === value)) return false;
  const dimensionScores = Object.values(candidate.qualityDimensions);
  const naturalQuestion = /^(?:About|Roughly|How|What|In what)\b/.test(candidate.prompt) && candidate.prompt.endsWith("?");
  return candidate.prompt.length >= 20 && candidate.prompt.length <= 180 && naturalQuestion &&
    !FORBIDDEN_PLAYER_LANGUAGE.test(candidate.prompt) &&
    !ARBITRARY_NUMERIC_METRIC.test(`${candidate.prompt} ${candidate.topic} ${candidate.unit}`) &&
    Number.isFinite(candidate.answer) && candidate.answer > 0 &&
    Boolean(candidate.unit.trim()) && Boolean(candidate.displayAnswer.trim()) &&
    /^https?:\/\//i.test(candidate.sourceNote) && Boolean(candidate.sourceSnapshot.trim()) &&
    !Number.isNaN(Date.parse(candidate.verifiedAt)) &&
    BALLPARK_CATEGORIES.includes(candidate.category) &&
    ["approachable", "standard", "challenging"].includes(candidate.difficultyTier) &&
    candidate.difficulty === legacyDifficulty(candidate.difficultyTier) &&
    scoresAreValid([...dimensionScores, candidate.qualityScore, candidate.quality.overallScore]) &&
    candidate.qualityDimensions.recognizability >= 70 &&
    candidate.qualityDimensions.wordingClarity >= 80 &&
    candidate.qualityDimensions.answerStability >= 70 &&
    candidate.qualityDimensions.unitFamiliarity >= 70 &&
    candidate.qualityDimensions.entertainmentValue >= 75 &&
    candidate.qualityScore >= 72 && candidate.qualityApproved &&
    candidate.quality.finalEligibility && candidate.quality.rejectionReasons.length === 0 &&
    candidate.validationVersion === QUALITY_VERSION;
}

function distribution<T>(items: readonly T[], value: (item: T) => string) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = value(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function validateInOrderInventoryDistribution(candidates: readonly InOrderCandidate[]): InventoryDistributionValidation {
  const counts = distribution(candidates, (candidate) => candidate.categoryFamily);
  const errors: string[] = [];
  const meaningfulFamilies = Object.values(counts).filter((count) => count >= 10).length;
  const maxFamily = Math.max(0, ...Object.values(counts));
  const countryCount = counts["mainstream-country-city-facts"] ?? 0;
  if (candidates.length < 600) errors.push("At least 600 eligible In Order candidates are required.");
  if (!candidates.every(validateObjectiveOrdering)) errors.push("Every In Order candidate must pass the quality and ordering validator.");
  if (meaningfulFamilies < 10) errors.push("At least 10 category families need meaningful inventory.");
  if (maxFamily > candidates.length * 0.2) errors.push("No In Order category family may exceed 20% of active inventory.");
  if (countryCount > candidates.length * 0.15) errors.push("Country statistics may not exceed 15% of active inventory.");
  return { valid: errors.length === 0, errors, counts };
}

export function validateBallparkInventoryDistribution(candidates: readonly NumericCandidate[]): InventoryDistributionValidation {
  const counts = distribution(candidates, (candidate) => candidate.category);
  const tiers = distribution(candidates, (candidate) => candidate.difficultyTier);
  const errors: string[] = [];
  if (candidates.length < 500) errors.push("At least 500 quality-approved Ballpark candidates are required.");
  if (!candidates.every(validateNumericCandidate)) errors.push("Every Ballpark candidate must pass the quality validator.");
  for (const category of BALLPARK_CATEGORIES) {
    if ((counts[category] ?? 0) < 25) errors.push(`${category} needs at least 25 eligible questions.`);
  }
  if (Math.max(0, ...Object.values(counts)) > candidates.length * 0.2) errors.push("No Ballpark category may exceed 20% of active inventory.");
  if (!(tiers.approachable && tiers.standard && tiers.challenging)) errors.push("All Ballpark difficulty tiers must be represented.");
  if ((tiers.approachable ?? 0) + (tiers.standard ?? 0) < candidates.length * 0.8) errors.push("Ballpark must favor approachable and standard questions.");
  return { valid: errors.length === 0, errors, counts: { ...counts, ...Object.fromEntries(Object.entries(tiers).map(([tier, count]) => [`tier:${tier}`, count])) } };
}

export const BALLPARK_CANDIDATES = buildNumericCandidates();
export const IN_ORDER_CANDIDATES = buildInOrderCandidates(600);

export function validateBuzzwordCandidate(candidate: BuzzwordCandidate) {
  if (!candidate || !Array.isArray(candidate.commonMisspellings) || !Array.isArray(candidate.misspellingEvidence)) return false;
  const normalizedMisspellings = candidate.commonMisspellings.map((word) => word.toLowerCase());
  const evidenceByValue = new Map(candidate.misspellingEvidence.map((evidence) => [evidence.value.toLowerCase(), evidence]));
  return /^[a-z]{5,22}$/.test(candidate.word) && candidate.definition.length >= 12 &&
    candidate.pronunciationHint.length >= 3 && candidate.pronunciationValid &&
    !/[\d*]|(?:^|-)[a-z](?:-|$)/.test(candidate.pronunciationHint) &&
    normalizedMisspellings.length >= 2 && candidate.misspellingValid &&
    new Set(normalizedMisspellings).size === normalizedMisspellings.length &&
    !normalizedMisspellings.includes(candidate.word.toLowerCase()) &&
    normalizedMisspellings.every((word) => {
      const evidence = evidenceByValue.get(word);
      return Boolean(evidence && evidence.score >= 0.7 && /confusion|consonant|suffix|silent-letter|phonetic|omission/i.test(evidence.rule));
    }) &&
    candidate.misspellingPlausibilityScore >= 70 && candidate.qualityScore >= 70 &&
    candidate.validationVersion === "buzzword-v4";
}
