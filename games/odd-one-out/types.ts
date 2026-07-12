export const ODD_ONE_OUT_CATEGORIES = [
  "geography",
  "science",
  "animals",
  "sports",
  "movies",
  "music",
  "video-games",
  "television",
  "books",
  "history",
  "food",
  "brands-and-companies",
  "technology",
  "language",
  "landmarks",
  "mythology",
  "art-and-culture"
] as const;

export type OddOneOutCategory = typeof ODD_ONE_OUT_CATEGORIES[number];
export type OddOneOutDifficulty = "approachable" | "standard" | "challenging";
export type OddOneOutSourceStrategy = "project-authored-source-backed-template";

export type FiveOddOneOutItems = readonly [string, string, string, string, string];
export type FourMatchingItems = readonly [string, string, string, string];

export type OddOneOutReview = {
  status: "passed";
  exactlyOneItemOutsideSharedProperty: true;
  alternativesReviewed: true;
  generalAudience: true;
  gotchaFree: true;
};

export type OddOneOutCandidate = {
  id: string;
  category: OddOneOutCategory;
  difficulty: OddOneOutDifficulty;
  prompt: string;
  items: FiveOddOneOutItems;
  answer: string;
  matchingItems: FourMatchingItems;
  explanation: string;
  sharedProperty: string;
  oddReason: string;
  sourceNote: string;
  sourceStrategy: OddOneOutSourceStrategy;
  qualityScore: number;
  recognizabilityScore: number;
  exactDuplicateKey: string;
  semanticTopicKey: string;
  answerKey: string;
  duplicateKeys: readonly string[];
  validationVersion: string;
  ambiguityReview: OddOneOutReview;
};

export type OddOneOutValidation = {
  valid: boolean;
  checks: Record<string, boolean>;
  errors: string[];
};

export type OddOneOutDiagnostics = {
  selectedDate: string;
  cacheKey: string;
  status: "Cached" | "Generated";
  contentHash: string;
  categoryFamily: OddOneOutCategory;
  difficulty: OddOneOutDifficulty;
  qualityScore: number;
  recognizabilityScore: number;
  exactDuplicateStatus: "available";
  cooldownStatus: "clear" | "relaxed";
  inventoryTotal: number;
  eligibleInventory: number;
  unusedEligibleInventory: number;
  rejectedCandidates: number;
  selectedCandidateId: string;
  sourceGenerationStrategy: OddOneOutSourceStrategy;
  sourceStrategy: OddOneOutSourceStrategy;
  dynamoDbReads: number;
  dynamoDbKeysRead: number;
  dynamoDbWrites: number;
  candidateCollisionRetries: number;
  generationDurationMs: number;
};

export type OddOneOutPuzzle = {
  gameId: "odd-one-out";
  id: string;
  candidateId?: string;
  date: string;
  prompt: string;
  items: string[];
  answer: string;
  explanation: string;
  sharedProperty?: string;
  oddReason?: string;
  category: OddOneOutCategory;
  difficulty: OddOneOutDifficulty;
  qualityScore?: number;
  recognizabilityScore?: number;
  sourceNote?: string;
  sourceStrategy?: OddOneOutSourceStrategy;
  contentHash?: string;
  exactDuplicateKey?: string;
  semanticTopicKey?: string;
  answerKey?: string;
  validationVersion?: string;
  generatedAt?: string;
  cacheHit?: boolean;
  validation?: OddOneOutValidation;
  diagnostics?: OddOneOutDiagnostics;
  /** Compatibility alias for shared game plumbing. */
  uniqueContentKey?: string;
  duplicateCheck?: {
    passed: boolean;
    duplicateDetected: boolean;
    retryCount: number;
    checkedAgainstCount: number;
  };
};

export type OddOneOutState = {
  date: string;
  puzzle: OddOneOutPuzzle;
  selectedItem: string;
  correct: boolean;
  completed: boolean;
};

export type OddOneOutApiPayload = OddOneOutPuzzle | { puzzle: OddOneOutPuzzle };
