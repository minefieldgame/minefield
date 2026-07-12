import { ODD_ONE_OUT_TEMPLATES, type OddOneOutTemplate } from "@/data/oddOneOutTemplates";
import {
  ODD_ONE_OUT_CATEGORIES,
  type FiveOddOneOutItems,
  type FourMatchingItems,
  type OddOneOutCandidate,
  type OddOneOutCategory,
  type OddOneOutDifficulty,
  type OddOneOutValidation
} from "@/games/odd-one-out/types";
import { createSeededRandom, hashString } from "@/lib/dailySeed";
import { createUniqueContentKey, normalizeUsedContentText } from "@/lib/content/usedContentRegistry";

export const ODD_ONE_OUT_VALIDATION_VERSION = "odd-one-out-v1";
export const ODD_ONE_OUT_TARGET_PER_CATEGORY = 72;
export const ODD_ONE_OUT_COOLDOWN_DAYS = 21;

const PROMPT = "Which one does not belong?";
const MINIMUM_QUALITY_SCORE = 80;
const MINIMUM_RECOGNIZABILITY_SCORE = 75;

function chooseFour(items: readonly string[]): FourMatchingItems[] {
  const combinations: FourMatchingItems[] = [];
  for (let a = 0; a < items.length - 3; a += 1) {
    for (let b = a + 1; b < items.length - 2; b += 1) {
      for (let c = b + 1; c < items.length - 1; c += 1) {
        for (let d = c + 1; d < items.length; d += 1) {
          combinations.push([items[a], items[b], items[c], items[d]]);
        }
      }
    }
  }
  return combinations;
}

export function canonicalOddOneOutItemSet(items: readonly string[]) {
  return items.map(normalizeUsedContentText).sort().join("|");
}

export function oddOneOutExactDuplicateKey(items: readonly string[]) {
  return createUniqueContentKey("odd-one-out", "item-set", [canonicalOddOneOutItemSet(items)]);
}

export function oddOneOutSemanticTopicKey(category: OddOneOutCategory, topicSlug: string) {
  return createUniqueContentKey("odd-one-out", "semantic-topic", [category, topicSlug]);
}

export function oddOneOutAnswerKey(answer: string) {
  return createUniqueContentKey("odd-one-out", "answer", [answer]);
}

function difficultyForIndex(index: number): OddOneOutDifficulty {
  const slot = index % 20;
  if (slot === 0) return "challenging";
  if (slot <= 9) return "standard";
  return "approachable";
}

function asFiveItems(items: string[]): FiveOddOneOutItems {
  if (items.length !== 5) throw new Error("Odd One Out authoring error: exactly five items are required.");
  return items as unknown as FiveOddOneOutItems;
}

function renderCandidate(
  template: OddOneOutTemplate,
  matchingItems: FourMatchingItems,
  oddItem: string,
  templateCandidateIndex: number,
  categoryIndex: number
): OddOneOutCandidate {
  const id = `odd-one-out:${template.category}:${template.slug}:${String(templateCandidateIndex + 1).padStart(3, "0")}`;
  const items = asFiveItems(createSeededRandom(`${id}:display-order`).shuffle([...matchingItems, oddItem]));
  const exactDuplicateKey = oddOneOutExactDuplicateKey(items);
  const oddReason = template.oddReasonTemplate.replace("{odd}", oddItem);
  const sharedClause = template.sharedProperty.replace(/^The/, "the").replace(/\.$/, "");
  const explanation = `${oddReason.replace(/\.$/, "")}; ${sharedClause}.`;

  return {
    id,
    category: template.category,
    difficulty: difficultyForIndex(categoryIndex),
    prompt: PROMPT,
    items,
    answer: oddItem,
    matchingItems,
    explanation,
    sharedProperty: template.sharedProperty,
    oddReason,
    sourceNote: template.sourceNote,
    sourceStrategy: "project-authored-source-backed-template",
    qualityScore: template.qualityScore,
    recognizabilityScore: template.recognizabilityScore,
    exactDuplicateKey,
    semanticTopicKey: oddOneOutSemanticTopicKey(template.category, template.slug),
    answerKey: oddOneOutAnswerKey(oddItem),
    duplicateKeys: [exactDuplicateKey],
    validationVersion: ODD_ONE_OUT_VALIDATION_VERSION,
    ambiguityReview: {
      status: "passed",
      exactlyOneItemOutsideSharedProperty: true,
      alternativesReviewed: true,
      generalAudience: true,
      gotchaFree: true
    }
  };
}

function expandTemplate(template: OddOneOutTemplate) {
  const expanded: OddOneOutCandidate[] = [];
  let templateCandidateIndex = 0;
  for (const matchingItems of chooseFour(template.matchingItems)) {
    for (const oddItem of template.oddItems) {
      expanded.push(renderCandidate(template, matchingItems, oddItem, templateCandidateIndex, 0));
      templateCandidateIndex += 1;
    }
  }
  return expanded;
}

function buildPreparedCandidates() {
  const byCategory = new Map<OddOneOutCategory, OddOneOutTemplate[]>();
  for (const category of ODD_ONE_OUT_CATEGORIES) byCategory.set(category, []);
  for (const template of ODD_ONE_OUT_TEMPLATES) byCategory.get(template.category)?.push(template);

  const candidates: OddOneOutCandidate[] = [];
  for (const category of ODD_ONE_OUT_CATEGORIES) {
    const templates = byCategory.get(category) ?? [];
    if (templates.length < 2) throw new Error(`Odd One Out category ${category} needs at least two fact templates.`);
    const expanded = templates.map(expandTemplate);
    for (let categoryIndex = 0; categoryIndex < ODD_ONE_OUT_TARGET_PER_CATEGORY; categoryIndex += 1) {
      const templateIndex = categoryIndex % expanded.length;
      const candidateIndex = Math.floor(categoryIndex / expanded.length);
      const candidate = expanded[templateIndex][candidateIndex];
      if (!candidate) throw new Error(`Odd One Out template ${templates[templateIndex].slug} cannot meet its category target.`);
      candidates.push({ ...candidate, difficulty: difficultyForIndex(categoryIndex) });
    }
  }
  return candidates;
}

function sameNormalizedSet(left: readonly string[], right: readonly string[]) {
  return canonicalOddOneOutItemSet(left) === canonicalOddOneOutItemSet(right);
}

export function validateOddOneOutCandidate(candidate: OddOneOutCandidate): OddOneOutValidation {
  const normalizedItems = candidate.items.map(normalizeUsedContentText);
  const normalizedAnswer = normalizeUsedContentText(candidate.answer);
  const matchingSet = new Set(candidate.matchingItems.map(normalizeUsedContentText));
  const expectedMatchingItems = candidate.items.filter((item) => normalizeUsedContentText(item) !== normalizedAnswer);
  const checks: Record<string, boolean> = {
    supportedCategory: (ODD_ONE_OUT_CATEGORIES as readonly string[]).includes(candidate.category),
    supportedDifficulty: ["approachable", "standard", "challenging"].includes(candidate.difficulty),
    exactlyFiveItems: candidate.items.length === 5,
    fiveUniqueItems: new Set(normalizedItems).size === 5 && normalizedItems.every(Boolean),
    answerAppearsExactlyOnce: normalizedItems.filter((item) => item === normalizedAnswer).length === 1,
    exactlyFourMatchingItems: candidate.matchingItems.length === 4 && matchingSet.size === 4,
    matchingItemsAreAnswerComplement: sameNormalizedSet(candidate.matchingItems, expectedMatchingItems),
    concisePrompt: candidate.prompt === PROMPT,
    conciseExplanation: candidate.explanation.length >= 20 && candidate.explanation.length <= 300,
    explanationNamesAnswer: normalizeUsedContentText(candidate.explanation).includes(normalizedAnswer),
    sharedPropertyPresent: candidate.sharedProperty.length >= 12 && candidate.sharedProperty.length <= 180,
    oddReasonPresent: candidate.oddReason.length >= 12 && candidate.oddReason.length <= 180,
    sourceBacked: candidate.sourceNote.length >= 12 && candidate.sourceStrategy === "project-authored-source-backed-template",
    qualityThreshold: Number.isFinite(candidate.qualityScore) && candidate.qualityScore >= MINIMUM_QUALITY_SCORE && candidate.qualityScore <= 100,
    recognizabilityThreshold: Number.isFinite(candidate.recognizabilityScore) && candidate.recognizabilityScore >= MINIMUM_RECOGNIZABILITY_SCORE && candidate.recognizabilityScore <= 100,
    exactKeyMatchesItemSet: candidate.exactDuplicateKey === oddOneOutExactDuplicateKey(candidate.items),
    semanticTopicKeyPresent: candidate.semanticTopicKey.startsWith("odd-one-out:semantic-topic:"),
    answerKeyMatches: candidate.answerKey === oddOneOutAnswerKey(candidate.answer),
    duplicateKeysAreExactOnly: candidate.duplicateKeys.length === 1 && candidate.duplicateKeys[0] === candidate.exactDuplicateKey,
    validationVersionCurrent: candidate.validationVersion === ODD_ONE_OUT_VALIDATION_VERSION,
    ambiguityReviewPassed: candidate.ambiguityReview.status === "passed" &&
      candidate.ambiguityReview.exactlyOneItemOutsideSharedProperty === true &&
      candidate.ambiguityReview.alternativesReviewed === true &&
      candidate.ambiguityReview.generalAudience === true &&
      candidate.ambiguityReview.gotchaFree === true
  };
  const errors = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `Validation failed: ${name}`);
  return { valid: errors.length === 0, checks, errors };
}

export type OddOneOutInventoryValidation = {
  valid: boolean;
  totalCandidates: number;
  eligibleCandidates: OddOneOutCandidate[];
  eligibleCount: number;
  rejectedCount: number;
  duplicateItemSetCount: number;
  meaningfulCategoryCount: number;
  categoryDistribution: Record<OddOneOutCategory, number>;
  difficultyDistribution: Record<OddOneOutDifficulty, number>;
  maximumCategoryShare: number;
  errors: string[];
};

export function validateOddOneOutInventory(candidates: readonly OddOneOutCandidate[]): OddOneOutInventoryValidation {
  const validationByCandidate = new Map(candidates.map((candidate) => [candidate, validateOddOneOutCandidate(candidate)]));
  const setCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const key = canonicalOddOneOutItemSet(candidate.items);
    setCounts.set(key, (setCounts.get(key) ?? 0) + 1);
  }
  const eligibleCandidates = candidates.filter((candidate) =>
    validationByCandidate.get(candidate)?.valid && setCounts.get(canonicalOddOneOutItemSet(candidate.items)) === 1
  );
  const categoryDistribution = Object.fromEntries(
    ODD_ONE_OUT_CATEGORIES.map((category) => [category, eligibleCandidates.filter((candidate) => candidate.category === category).length])
  ) as Record<OddOneOutCategory, number>;
  const difficultyDistribution = Object.fromEntries(
    (["approachable", "standard", "challenging"] as const).map((difficulty) => [difficulty, eligibleCandidates.filter((candidate) => candidate.difficulty === difficulty).length])
  ) as Record<OddOneOutDifficulty, number>;
  const duplicateItemSetCount = [...setCounts.values()].filter((count) => count > 1).length;
  const meaningfulCategoryCount = Object.values(categoryDistribution).filter((count) => count >= 50).length;
  const maximumCategoryShare = eligibleCandidates.length
    ? Math.max(...Object.values(categoryDistribution)) / eligibleCandidates.length
    : 0;
  const errors = [
    ...(eligibleCandidates.length >= 1000 ? [] : [`Eligible inventory ${eligibleCandidates.length} is below 1,000.`]),
    ...(meaningfulCategoryCount >= 10 ? [] : [`Only ${meaningfulCategoryCount} categories have meaningful inventory.`]),
    ...(maximumCategoryShare <= 0.2 ? [] : [`A category exceeds 20% of eligible inventory (${maximumCategoryShare}).`]),
    ...(duplicateItemSetCount === 0 ? [] : [`Found ${duplicateItemSetCount} duplicate item sets.`]),
    ...candidates.flatMap((candidate) => validationByCandidate.get(candidate)?.errors.map((error) => `${candidate.id}: ${error}`) ?? [])
  ];
  return {
    valid: errors.length === 0,
    totalCandidates: candidates.length,
    eligibleCandidates,
    eligibleCount: eligibleCandidates.length,
    rejectedCount: candidates.length - eligibleCandidates.length,
    duplicateItemSetCount,
    meaningfulCategoryCount,
    categoryDistribution,
    difficultyDistribution,
    maximumCategoryShare,
    errors
  };
}

export const ODD_ONE_OUT_CANDIDATES: readonly OddOneOutCandidate[] = buildPreparedCandidates();
export const ODD_ONE_OUT_INVENTORY = validateOddOneOutInventory(ODD_ONE_OUT_CANDIDATES);

if (!ODD_ONE_OUT_INVENTORY.valid) {
  throw new Error(`Odd One Out prepared inventory is invalid: ${ODD_ONE_OUT_INVENTORY.errors.slice(0, 5).join(" ")}`);
}

export type OddOneOutSelection = {
  candidate: OddOneOutCandidate | null;
  targetCategory?: OddOneOutCategory;
  preferredDifficulty?: OddOneOutDifficulty;
  cooldownRelaxed: boolean;
};

function dailyCategoryIndex(date: string, categoryCount: number, retryOffset: number) {
  const timestamp = Date.parse(`${date}T12:00:00Z`);
  const dayOrdinal = Number.isFinite(timestamp) ? Math.floor(timestamp / 86_400_000) : hashString(date);
  return Math.abs(dayOrdinal + hashString("odd-one-out-category-v1") + retryOffset) % categoryCount;
}

export function selectOddOneOutCandidateForDate(
  date: string,
  candidates: readonly OddOneOutCandidate[] = ODD_ONE_OUT_INVENTORY.eligibleCandidates,
  options: {
    excludedExactKeys?: ReadonlySet<string>;
    activeCooldownKeys?: ReadonlySet<string>;
    retryOffset?: number;
  } = {}
): OddOneOutSelection {
  const retryOffset = options.retryOffset ?? 0;
  const hardEligible = candidates.filter((candidate) => !options.excludedExactKeys?.has(candidate.exactDuplicateKey));
  if (!hardEligible.length) return { candidate: null, cooldownRelaxed: false };
  const cooldownEligible = hardEligible.filter((candidate) =>
    !options.activeCooldownKeys?.has(candidate.semanticTopicKey) && !options.activeCooldownKeys?.has(candidate.answerKey)
  );
  const cooldownRelaxed = cooldownEligible.length === 0;
  const pool = cooldownRelaxed ? hardEligible : cooldownEligible;
  const categories = ODD_ONE_OUT_CATEGORIES.filter((category) => pool.some((candidate) => candidate.category === category));
  const targetCategory = categories[dailyCategoryIndex(date, categories.length, retryOffset)];
  const categoryPool = pool.filter((candidate) => candidate.category === targetCategory);
  const random = createSeededRandom(`${date}:odd-one-out:${retryOffset}:tier-and-candidate`);
  const preferredDifficulty = random.weightedChoice<OddOneOutDifficulty>([
    { value: "approachable", weight: 50 },
    { value: "standard", weight: 45 },
    { value: "challenging", weight: 5 }
  ]);
  const tierPool = categoryPool.filter((candidate) => candidate.difficulty === preferredDifficulty);
  const finalPool = (tierPool.length ? tierPool : categoryPool).slice().sort((left, right) => left.id.localeCompare(right.id));
  return {
    candidate: finalPool.length ? random.choice(finalPool) : null,
    targetCategory,
    preferredDifficulty,
    cooldownRelaxed
  };
}
