import type { RankedTopTenPuzzle } from "@/games/top-ten/types";
import type { DailyPuzzle } from "@/types/game";
import type { MinefieldPuzzle } from "@/games/minefield/logic";
import type { CloserPuzzle } from "@/games/closer/types";
import type { SpellDropPuzzle } from "@/games/spelldrop/types";
import type { GeneratedContentEnvelope } from "@/lib/content/dailyContentEngine";
import type { resolveMeetMeHalfwayPuzzle, resolveLandmarkDropPuzzle } from "@/games/geography/puzzles";

export type AdminResolverDiagnostics = {
  route: string;
  resolver: string;
  date: string;
  dateKey?: string;
  gameId?: string;
  seed?: number;
  temperature?: number;
  regeneratedThisSession?: boolean;
  cacheKey: string;
  cacheHit: boolean;
  envDetected: boolean;
  model: string;
  generatedAt?: string;
  errorType?: string;
  errorMessage?: string;
};

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
        requestedChartDate: string;
        resolvedChartDate: string;
        fallbackUsed: boolean;
        fallbackReason: string;
        attemptedYears: number[];
        attemptedChartDates: string[];
        attemptedChartPositions: number[];
        previewAvailability: Array<{
          year: number;
          chartDate: string;
          chartPosition: number;
          title: string;
          artist: string;
          available: boolean;
        }>;
        finalSelectedSong: string;
        errors: string[];
      };
      rawProviderResponse: unknown;
    }
  | { status: "error"; error: string };

export type AdminTopTenPreview =
  | {
      status: "ready";
      puzzle: RankedTopTenPuzzle;
      diagnostics: {
        sourceProvider: string;
        validationStatus: string;
        dataFreshness: string;
        confidence: number;
        generationMode: string;
        apiKeyConfigured: boolean;
        warning: string | null;
        errors: string[];
        resolverDiagnostics: AdminResolverDiagnostics;
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
        generationStatus: "failed";
        validationStatus: "not-run";
        sourceData: string[];
        contentHash: null;
        fallbackUsed: false;
        errors: string[];
        resolverDiagnostics: AdminResolverDiagnostics;
      };
    };

export type AdminPreviewResponse = {
  date: string;
  pacificDate: string;
  dailySeed: number;
  seedHash: string;
  generatedAt: string;
  cacheKeys: {
    rankedTopTen: string;
    spellDrop: string;
    closer: string;
  };
  games: {
    needledrop: AdminNeedleDropPreview;
    topTen: AdminTopTenPreview;
    spellDrop: AdminSpellDropPreview;
    minefield: AdminMinefieldPreview;
    closer: AdminCloserPreview;
    meetMeHalfway: AdminMeetMeHalfwayPreview;
    landmarkDrop: AdminLandmarkDropPreview;
  };
};

export type AdminDynamicError = {
  status: "error";
  error: string;
  diagnostics: {
    apiKeyConfigured: boolean;
    liveGenerationEnabled: boolean;
    model: string;
    generationStatus: "failed";
    validationStatus: "not-run";
    sourceData: string[];
    contentHash: null;
    fallbackUsed: false;
    errors: string[];
    resolverDiagnostics: AdminResolverDiagnostics;
  };
};

export type AdminSpellDropPreview =
  | ({ status: "ready"; diagnostics: AdminResolverDiagnostics } & GeneratedContentEnvelope<SpellDropPuzzle>)
  | AdminDynamicError;

export type AdminMinefieldPreview = {
  status: "ready";
  puzzle: MinefieldPuzzle;
};

export type AdminCloserPreview =
  | ({ status: "ready"; diagnostics: AdminResolverDiagnostics } & GeneratedContentEnvelope<CloserPuzzle>)
  | AdminDynamicError;

export type AdminMeetMeHalfwayPreview = {
  status: "ready";
  puzzle: ReturnType<typeof resolveMeetMeHalfwayPuzzle>;
};

export type AdminLandmarkDropPreview = {
  status: "ready";
  puzzle: ReturnType<typeof resolveLandmarkDropPuzzle>;
  imageStatus: string;
};
