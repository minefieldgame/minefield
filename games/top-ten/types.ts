export type TopTenDifficulty = "easy" | "medium" | "hard";
export type TopTenGenerationMode = "live-ai" | "development-mock";

export type TopTenCategory = {
  id: string;
  title: string;
  displayName: string;
  prompt: string;
  topicArea: string;
  rankingMetric: string;
  expectedAnswerType: string;
  answerType: string;
  sourceStrategy: string;
  source: string;
  aliasStrategy: string;
  difficulty: TopTenDifficulty;
  safetyRating: "safe";
};

export type TopTenAnswer = {
  rank: number;
  name: string;
  aliases: string[];
  value: string;
  sourceNote: string;
};

export type TopTenValidation = {
  valid: boolean;
  checks: {
    rankedPrompt: boolean;
    exactlyThreeAnswers: boolean;
    uniqueAnswers: boolean;
    objectiveRanking: boolean;
    safeAliases: boolean;
    understandableCategory: boolean;
    reliableSources: boolean;
  };
  errors: string[];
};

export type TopTenPuzzle = {
  id: string;
  date: string;
  category: TopTenCategory;
  answers: TopTenAnswer[];
  sources: string[];
  sourceUrl: string;
  generatedAt: string;
  confidence: number;
  validation: TopTenValidation;
  generationMode: TopTenGenerationMode;
  warning?: string;
  rawAIResponse?: unknown;
};

export type TopTenState = {
  puzzle: TopTenPuzzle;
  found: string[];
  misses: string[];
  status: "playing" | "completed" | "gave-up";
  updatedAt: string;
};
