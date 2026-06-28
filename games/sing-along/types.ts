import type { TrackPreview } from "@/types/game";

export type SingAlongPuzzle = {
  gameId: "sing-along";
  id: string;
  date: string;
  seed: number;
  title: string;
  artist: string;
  chartDate: string;
  chartYear: number;
  chartPosition: number;
  track: TrackPreview;
  playbackStart: number;
  playbackStop: number;
  chorusTimestamp: number;
  acceptedLyric: string;
  alternateAcceptedLyrics: string[];
  sourceNote: string;
  generatedAt: string;
  contentHash: string;
};

export type SingAlongState = {
  dateKey: string;
  puzzle: SingAlongPuzzle;
  guess: string;
  score: number;
  label: string;
  completed: boolean;
  correct: boolean;
};
