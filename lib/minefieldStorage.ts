import type { MinefieldDailyBoard, MinefieldGameResult, MinefieldStats, MinefieldSummary } from "@/types/minefield";
import { getBoardCacheKey, getGameCacheKey } from "@/lib/date";
import { GAME_DISPLAY } from "@/lib/gameDisplay";

const ARCHIVE_KEY = "minefield:archive";
const STATS_KEY = "minefield:stats";
const EMPTY_STATS: MinefieldStats = { currentStreak: 0, maxStreak: 0 };
const RESULT_ORDER: MinefieldGameResult["gameId"][] = [
  "needledrop", "sing-along", "ranked-top-5", "spelldrop", "closer",
  "meet-me-halfway", "landmark-drop", "minefield"
];
const GAME_DEFAULTS = {
  "sing-along": { displayName: "Sing Along", icon: "🎤", totalUnits: 1 },
  needledrop: { displayName: "Rewind", icon: "🎵", totalUnits: 7 },
  minefield: { displayName: "Minefield", icon: "💣", totalUnits: 6 },
  "ranked-top-5": { displayName: "In Order", icon: "🏆", totalUnits: 5 },
  spelldrop: { displayName: "Buzzword", icon: "🔤", totalUnits: 1 },
  closer: { displayName: "In the Ballpark", icon: "🎯", totalUnits: 1 },
  "meet-me-halfway": { displayName: "Meet Me Halfway", icon: "🌍", totalUnits: 1 },
  "landmark-drop": { displayName: "On a Postcard", icon: "🗼", totalUnits: 1 }
} as const;

function boardKey(date: string, scope?: string) {
  return getBoardCacheKey(date, scope);
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function normalizeResult(gameId: MinefieldGameResult["gameId"], result: MinefieldGameResult, date: string) {
  const defaults = GAME_DEFAULTS[gameId];
  const summaryLabel = result.summaryLabel ?? result.detail ?? "Completed";
  const recovered = !result.reviewData || result.reviewData.type === "legacy"
    ? recoverReviewData(gameId, date)
    : null;
  const reviewData = recovered ?? result.reviewData ?? {
    type: "legacy" as const,
    message: "Detailed answer review is unavailable for this previously saved result."
  };
  const safeReviewData = reviewData.type === "legacy" && /error|generate|failed/i.test(reviewData.message)
    ? { type: "legacy" as const, message: "Today’s puzzle was unavailable." }
    : reviewData;
  return {
    ...result, gameId,
    displayName: GAME_DISPLAY[gameId].name,
    icon: result.icon ?? defaults.icon,
    maxScore: result.maxScore ?? 100,
    successUnits: result.successUnits ?? 0,
    totalUnits: result.totalUnits ?? defaults.totalUnits,
    summaryLabel,
    shareLine: result.shareLine ??
      `${defaults.icon} ${GAME_DISPLAY[gameId].name}: ${result.score ?? 0}/${result.maxScore ?? 100}, ${summaryLabel.toLowerCase()}`,
    reviewData: safeReviewData,
    detail: result.detail ?? summaryLabel
  } satisfies MinefieldGameResult;
}

function recoverReviewData(
  gameId: MinefieldGameResult["gameId"],
  date: string
): MinefieldGameResult["reviewData"] | null {
  if (typeof window === "undefined") return null;
  try {
    if (gameId === "ranked-top-5") {
      const state = read<{
        puzzle: { playerPrompt: string; answers: Array<{ rank: number; answer: string }> };
        order: string[];
        lockedPositions: number[];
        attemptsUsed: number;
      } | null>(getGameCacheKey("ranked-top-5", date), null);
      if (state) {
        return {
          type: "ranked-top-5",
          prompt: state.puzzle.playerPrompt,
          userOrder: state.order,
          correctOrder: [...state.puzzle.answers].sort((a, b) => a.rank - b.rank).map((answer) => answer.answer),
          correctPositions: state.lockedPositions,
          attemptsUsed: state.attemptsUsed
        };
      }
    }
    if (gameId === "spelldrop") {
      const state = read<{
        guess: string;
        correct: boolean;
        puzzle: { word: string; definition?: string };
      } | null>(getGameCacheKey("spelldrop", date), null);
      if (state?.puzzle) {
        return {
          type: "spelldrop",
          correctWord: state.puzzle.word,
          userSpelling: state.guess,
          correct: state.correct,
          definition: state.puzzle.definition
        };
      }
    }
    if (gameId === "closer") {
      const state = read<{
        rawGuess: string;
        numericGuess: number;
        puzzle: {
          prompt: string;
          answer: number;
          displayAnswer: string;
          sourceNote: string;
        };
      } | null>(getGameCacheKey("closer", date), null);
      if (state?.puzzle) {
        const percentError = Math.abs(state.numericGuess - state.puzzle.answer) / Math.abs(state.puzzle.answer);
        return {
          type: "closer",
          prompt: state.puzzle.prompt,
          userGuess: state.numericGuess,
          rawGuess: state.rawGuess,
          actualAnswer: state.puzzle.answer,
          displayAnswer: state.puzzle.displayAnswer,
          percentError,
          sourceNote: state.puzzle.sourceNote,
          scoreLabel: percentError <= 0.01 ? "Right on the money" : percentError <= 0.1 ? "Very close" : "Completed",
          absoluteDifference: Math.abs(state.numericGuess - state.puzzle.answer),
          scoringProfile: "large-estimate"
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function loadGameProgress(date: string, scope?: string): MinefieldDailyBoard {
  const board = read<MinefieldDailyBoard>(boardKey(date, scope), { date, results: {} });
  const results = Object.fromEntries(
    Object.entries(board.results)
      .filter(([gameId]) => RESULT_ORDER.includes(gameId as MinefieldGameResult["gameId"]))
      .map(([gameId, value]) => {
      const id = gameId as MinefieldGameResult["gameId"];
      return [id, normalizeResult(id, value as MinefieldGameResult, board.date)];
      })
  ) as MinefieldDailyBoard["results"];
  if (
    results.minefield?.reviewData.type === "minefield" &&
    !results.minefield.reviewData.difficulty
  ) {
    delete results.minefield;
  }
  for (const gameId of ["ranked-top-5", "spelldrop", "closer"] as const) {
    const result = results[gameId];
    if (
      result &&
      (/unavailable/i.test(result.summaryLabel) ||
        (result.reviewData.type === "legacy" && /unavailable|could not be loaded/i.test(result.reviewData.message)))
    ) {
      delete results[gameId];
    }
  }
  return { ...board, results };
}

export function saveGameProgress(date: string, result: MinefieldGameResult, scope?: string) {
  const board = loadGameProgress(date, scope);
  const next: MinefieldDailyBoard = { ...board, results: { ...board.results, [result.gameId]: result } };
  localStorage.setItem(boardKey(date, scope), JSON.stringify(next));
  return next;
}

export function calculateDailySummary(board: MinefieldDailyBoard, totalGames = 8): MinefieldSummary {
  const results = (Object.values(board.results).filter(Boolean) as MinefieldGameResult[]).sort(
    (left, right) => RESULT_ORDER.indexOf(left.gameId) - RESULT_ORDER.indexOf(right.gameId)
  );
  return {
    date: board.date,
    totalScore: results.reduce((sum, result) => sum + result.score, 0),
    maxScore: results.reduce((sum, result) => sum + result.maxScore, 0),
    gamesCompleted: results.filter((result) => result.completed).length,
    totalGames,
    results
  };
}

function previousPacificDate(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function completeDailyBoard(board: MinefieldDailyBoard, totalGames = 8, scope?: string) {
  const summary = calculateDailySummary(board, totalGames);
  if (summary.gamesCompleted < totalGames) return summary;
  if (scope) return summary;
  const archived = read<MinefieldSummary[]>(ARCHIVE_KEY, []);
  const existingEntry = archived.some((entry) => entry.date === board.date);
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify([summary, ...archived.filter((entry) => entry.date !== board.date)].slice(0, 180)));
  if (!existingEntry) {
    const stats = read<MinefieldStats>(STATS_KEY, EMPTY_STATS);
    const continued = stats.lastCompletedDate === previousPacificDate(board.date);
    const currentStreak = continued ? stats.currentStreak + 1 : 1;
    localStorage.setItem(STATS_KEY, JSON.stringify({
      currentStreak,
      maxStreak: Math.max(stats.maxStreak, currentStreak),
      lastCompletedDate: board.date
    }));
  }
  return summary;
}

export function loadMinefieldArchive() {
  return read<MinefieldSummary[]>(ARCHIVE_KEY, []);
}

export function loadMinefieldStats() {
  return read<MinefieldStats>(STATS_KEY, EMPTY_STATS);
}
