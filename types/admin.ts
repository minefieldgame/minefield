import type { TopTenPuzzle } from "@/games/top-ten/types";
import type { DailyPuzzle } from "@/types/game";
import type { MinefieldPuzzle } from "@/games/minefield/logic";
import type { CloserPuzzle } from "@/games/closer/types";

export type AdminNeedleDropPreview =
  | {
      status: "ready";
      puzzle: DailyPuzzle;
      diagnostics: {
        requestStatus: string;
        responseStatus: number;
        matchConfidence: number;
        previewAvailable: boolean;
        sourceProvider: string;
        generatedAt: string;
        rawITunesTitle: string;
        normalizedCorrectTitle: string;
        normalizedCorrectArtist: string;
        errors: string[];
      };
      rawProviderResponse: unknown;
    }
  | { status: "error"; error: string };

export type AdminTopTenPreview =
  | {
      status: "ready";
      puzzle: TopTenPuzzle;
      diagnostics: {
        sourceProvider: string;
        validationStatus: string;
        dataFreshness: string;
        confidence: number;
        generationMode: string;
        apiKeyConfigured: boolean;
        warning: string | null;
        errors: string[];
      };
      rawProviderResponse: unknown;
    }
  | {
      status: "error";
      error: string;
      diagnostics?: {
        apiKeyConfigured: boolean;
        liveAIEnabled: boolean;
        model: string;
        generationMode: string;
        failureReason: string;
      };
    };

export type AdminPreviewResponse = {
  date: string;
  pacificDate: string;
  dailySeed: number;
  seedHash: string;
  generatedAt: string;
  games: {
    needledrop: AdminNeedleDropPreview;
    topTen: AdminTopTenPreview;
    spellDrop: AdminSpellDropPreview;
    minefield: AdminMinefieldPreview;
    closer: AdminCloserPreview;
  };
};

export type AdminSpellDropPreview = {
  status: "ready";
  word: string;
  acceptedSpelling: string;
  dateSeed: number;
  replayLimit: number;
  wordCount: number;
};

export type AdminMinefieldPreview = {
  status: "ready";
  puzzle: MinefieldPuzzle;
};

export type AdminCloserPreview = {
  status: "ready";
  puzzle: CloserPuzzle;
  validation: { valid: boolean; errors: string[] };
  questionPoolSize: number;
};
