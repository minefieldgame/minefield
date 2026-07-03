import type { TrackPreview } from "@/types/game";

export type SingAlongPuzzle = {
  gameId: "sing-along";
  gameVersion: "v2";
  id: string;
  date: string;
  dateKey: string;
  masterSeed: string;
  gameSeed: number;
  seed: number;
  title: string;
  songTitle: string;
  artist: string;
  previewUrl: string;
  chartDate: string;
  chartYear: number;
  chartPosition: number;
  track: TrackPreview;
  playbackStart: number;
  playbackStop: number;
  stopTimestamp: number;
  chorusTimestamp: number;
  cueDescription: string;
  acceptedLyric: string;
  alternateAcceptedLyrics: string[];
  correctChoiceId: "a" | "b" | "c" | "d";
  choices: Array<{ id: "a" | "b" | "c" | "d"; text: string; isCorrect: boolean }>;
  sourceNote: string;
  deterministicSelectors: Record<string, string>;
  promptConstraints: string;
  validation: { valid: boolean; errors: string[] };
  repeatStatus: { checked: boolean; retryCount: number; provider: string };
  generatedAt: string;
  contentHash: string;
};

export type SingAlongState = {
  dateKey: string;
  puzzle: SingAlongPuzzle;
  selectedChoiceId: string;
  score: number;
  label: string;
  completed: boolean;
  correct: boolean;
};
