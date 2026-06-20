export type SpellDropPuzzle = {
  gameId: "spelldrop";
  date: string;
  seed: number;
  word: string;
  definition: string;
  commonMisspellings: string[];
  difficulty: "easy" | "medium" | "hard";
  pronunciationHint: string;
  contentHash?: string;
  confidence?: number;
  generatedAt?: string;
};
