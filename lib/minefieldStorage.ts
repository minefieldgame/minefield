import type { MinefieldDailyBoard, MinefieldGameResult, MinefieldStats, MinefieldSummary } from "@/types/minefield";

const BOARD_PREFIX = "minefield:board:";
const ARCHIVE_KEY = "minefield:archive";
const STATS_KEY = "minefield:stats";
const EMPTY_STATS: MinefieldStats = { currentStreak: 0, maxStreak: 0 };
const RESULT_ORDER: MinefieldGameResult["gameId"][] = [
  "needledrop", "minefield", "top-ten", "spelldrop", "closer",
  "meet-me-halfway", "landmark-drop"
];
const GAME_DEFAULTS = {
  needledrop: { displayName: "NeedleDrop", icon: "🎵", totalUnits: 7 },
  minefield: { displayName: "Minefield", icon: "💣", totalUnits: 5 },
  "top-ten": { displayName: "Top 3", icon: "🏆", totalUnits: 3 },
  spelldrop: { displayName: "SpellDrop", icon: "🔤", totalUnits: 1 },
  closer: { displayName: "Closer", icon: "🎯", totalUnits: 1 },
  "meet-me-halfway": { displayName: "Meet Me Halfway", icon: "🌍", totalUnits: 1 },
  "landmark-drop": { displayName: "Landmark Drop", icon: "🗼", totalUnits: 1 }
} as const;

function boardKey(date: string, scope?: string) {
  return scope ? `${BOARD_PREFIX}${scope}:${date}` : `${BOARD_PREFIX}${date}`;
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
    displayName: result.displayName ?? defaults.displayName,
    icon: result.icon ?? defaults.icon,
    maxScore: result.maxScore ?? 100,
    successUnits: result.successUnits ?? 0,
    totalUnits: result.totalUnits ?? defaults.totalUnits,
    summaryLabel,
    shareLine: result.shareLine ??
      `${defaults.icon} ${result.displayName ?? defaults.displayName}: ${result.score ?? 0}/${result.maxScore ?? 100}, ${summaryLabel.toLowerCase()}`,
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
    if (gameId === "top-ten") {
      const state = read<{
        puzzle: { category: { prompt: string }; answers: Array<{ name: string }> };
        found: string[];
      } | null>(`minefield:top-three:v1:${date}`, null);
      if (state) {
        const answers = state.puzzle.answers.map((answer) => answer.name);
        return {
          type: "top-three",
          prompt: state.puzzle.category.prompt,
          answers,
          found: state.found,
          missed: answers.filter((answer) => !state.found.includes(answer))
        };
      }
    }
    if (gameId === "spelldrop") {
      const state = read<{
        guess: string;
        correct: boolean;
        puzzle: { word: string; definition?: string };
      } | null>(`minefield:spelldrop:v2:${date}`, null);
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
      } | null>(`minefield:closer:v2:${date}`, null);
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
          scoreLabel: percentError <= 0.01 ? "Dead on" : percentError <= 0.1 ? "Very close" : "Completed"
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
    Object.entries(board.results).map(([gameId, value]) => {
      const id = gameId as MinefieldGameResult["gameId"];
      return [id, normalizeResult(id, value as MinefieldGameResult, board.date)];
    })
  ) as MinefieldDailyBoard["results"];
  return { ...board, results };
}

export function saveGameProgress(date: string, result: MinefieldGameResult, scope?: string) {
  const board = loadGameProgress(date, scope);
  const next: MinefieldDailyBoard = { ...board, results: { ...board.results, [result.gameId]: result } };
  localStorage.setItem(boardKey(date, scope), JSON.stringify(next));
  return next;
}

export function calculateDailySummary(board: MinefieldDailyBoard, totalGames = 7): MinefieldSummary {
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

export function completeDailyBoard(board: MinefieldDailyBoard, totalGames = 7, scope?: string) {
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
