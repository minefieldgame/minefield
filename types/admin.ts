import type { TopTenPuzzle } from "@/games/top-ten/types";
import type { DailyPuzzle } from "@/types/game";

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
  | { status: "error"; error: string };

export type AdminPreviewResponse = {
  date: string;
  pacificDate: string;
  dailySeed: number;
  seedHash: string;
  generatedAt: string;
  games: {
    needledrop: AdminNeedleDropPreview;
    topTen: AdminTopTenPreview;
  };
};
