export type SpellDropPuzzle = {
  gameId: "spelldrop";
  date: string;
  seed: number;
  word: string;
  definition: string;
  commonMisspellings: string[];
  difficulty: "easy" | "medium" | "hard";
  pronunciationHint: string;
  qualityScore?: number;
  misspellingPlausibilityScore?: number;
  contentHash?: string;
  confidence?: number;
  generatedAt?: string;
  uniqueContentKey?: string;
  duplicateCheck?: {
    duplicateDetected: boolean;
    passed: boolean;
    regenerationCount: number;
    retryCount: number;
    exhaustedCandidatePool: boolean;
    checkedAgainstCount: number;
    recentlyUsedKeys: string[];
    warning?: string;
  };
  repeatStatus?: {
    checked: boolean;
    passed?: boolean;
    duplicateDetected?: boolean;
    retryCount: number;
    provider: string;
    warning?: string;
  };
};
