export type ChartSong = {
  title: string;
  artist: string;
  position: number;
};

export type TrackPreview = {
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl: string;
  previewUrl: string;
  trackViewUrl: string;
  trackId?: number | string;
  collectionId?: number | string;
  recordingIdentity?: string;
  previewDurationSeconds?: number;
  matchConfidence?: number;
  sourceProvider?: string;
  lastVerifiedAt?: string;
  /** Provider catalog date. This is not necessarily the recording's original release date. */
  providerReleaseDate?: string;
  /** Populate only from explicit recording-level provenance; never infer from a reissue or collection date. */
  originalReleaseYear?: number;
  originalReleaseYearSource?: string;
};

export type SongSuggestion = {
  id: number | string;
  title: string;
  artist: string;
  rawTitle?: string;
};

export type SongGuessSubmission = {
  displayValue: string;
  title: string;
  artist: string;
  selectedAutocomplete: boolean;
};

export type DailyPuzzle = {
  id: string;
  number: number;
  puzzleDate: string;
  chartDate: string;
  chartSourceDate?: string;
  chartYear: number;
  chartPosition: number;
  /** Distinct from chartYear. Absent means authoritative release provenance was unavailable. */
  originalReleaseYear?: number;
  originalReleaseYearSource?: string;
  title: string;
  artist: string;
  track: TrackPreview;
  uniqueContentKey?: string;
  secondaryKeys?: string[];
  musicUsedContentKey?: string;
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
};

export type GameStatus = "playing" | "won" | "lost";

export type GameState = {
  puzzle: DailyPuzzle;
  attempt: number;
  guesses: string[];
  status: GameStatus;
  score: number;
  updatedAt: string;
};

export type GuessDistribution = Record<string, number>;

export type Stats = {
  gamesPlayed: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  totalScore: number;
  perfectGuesses: number;
  guessDistribution: GuessDistribution;
  lastPlayedDate?: string;
};

export type ArchiveEntry = {
  id: string;
  puzzleDate: string;
  chartDate: string;
  title: string;
  artist: string;
  position: number;
  status: GameStatus;
  score: number;
  attempt: number;
};
