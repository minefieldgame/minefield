import type {
  MinefieldDailyBoard,
  MinefieldGameResult,
  MinefieldStats,
  MinefieldSummary
} from "@/types/minefield";

const BOARD_PREFIX = "minefield:board:";
const ARCHIVE_KEY = "minefield:archive";
const STATS_KEY = "minefield:stats";

const EMPTY_STATS: MinefieldStats = { currentStreak: 0, maxStreak: 0 };
const RESULT_ORDER: MinefieldGameResult["gameId"][] = [
  "needledrop",
  "minefield",
  "top-ten",
  "spelldrop",
  "closer"
];
const GAME_DEFAULTS = {
  needledrop: { displayName: "NeedleDrop", icon: "🎵", totalUnits: 7 },
  minefield: { displayName: "Minefield", icon: "💣", totalUnits: 5 },
  "top-ten": { displayName: "Top 3", icon: "🏆", totalUnits: 3 },
  spelldrop: { displayName: "SpellDrop", icon: "🔤", totalUnits: 1 },
  closer: { displayName: "Closer", icon: "🎯", totalUnits: 1 }
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadGameProgress(date: string): MinefieldDailyBoard {
  const board = read<MinefieldDailyBoard>(`${BOARD_PREFIX}${date}`, { date, results: {} });
  const results = Object.fromEntries(
    Object.entries(board.results).map(([gameId, value]) => {
      const id = gameId as MinefieldGameResult["gameId"];
      return [id, normalizeResult(id, value as MinefieldGameResult)];
    })
  ) as MinefieldDailyBoard["results"];
  return { ...board, results };
}

function normalizeResult(gameId: MinefieldGameResult["gameId"], result: MinefieldGameResult) {
  const defaults = GAME_DEFAULTS[gameId];
  const summaryLabel = result.summaryLabel ?? result.detail ?? "Completed";
  return {
    ...result,
    gameId,
    displayName: result.displayName ?? defaults.displayName,
    icon: result.icon ?? defaults.icon,
    maxScore: result.maxScore ?? 100,
    successUnits: result.successUnits ?? 0,
    totalUnits: result.totalUnits ?? defaults.totalUnits,
    summaryLabel,
    shareLine:
      result.shareLine ??
      `${defaults.icon} ${result.displayName ?? defaults.displayName}: ${result.score ?? 0}/${result.maxScore ?? 100}, ${summaryLabel.toLowerCase()}`,
    reviewData: result.reviewData ?? {
      type: "legacy",
      message: "Detailed answer review is unavailable for this previously saved result."
    },
    detail: result.detail ?? summaryLabel
  } satisfies MinefieldGameResult;
}

export function saveGameProgress(date: string, result: MinefieldGameResult) {
  const board = loadGameProgress(date);
  const next: MinefieldDailyBoard = {
    ...board,
    results: { ...board.results, [result.gameId]: result }
  };
  localStorage.setItem(`${BOARD_PREFIX}${date}`, JSON.stringify(next));
  return next;
}

export function calculateDailySummary(
  board: MinefieldDailyBoard,
  totalGames = 5
): MinefieldSummary {
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

export function completeDailyBoard(board: MinefieldDailyBoard, totalGames = 5) {
  const summary = calculateDailySummary(board, totalGames);
  if (summary.gamesCompleted < totalGames) return summary;

  const archived = read<MinefieldSummary[]>(ARCHIVE_KEY, []);
  const existingEntry = archived.some((entry) => entry.date === board.date);
  localStorage.setItem(
    ARCHIVE_KEY,
    JSON.stringify([summary, ...archived.filter((entry) => entry.date !== board.date)].slice(0, 180))
  );
  if (!existingEntry) {
    const stats = read<MinefieldStats>(STATS_KEY, EMPTY_STATS);
    const continued = stats.lastCompletedDate === previousPacificDate(board.date);
    const currentStreak = continued ? stats.currentStreak + 1 : 1;
    localStorage.setItem(
      STATS_KEY,
      JSON.stringify({
        currentStreak,
        maxStreak: Math.max(stats.maxStreak, currentStreak),
        lastCompletedDate: board.date
      })
    );
  }
  return summary;
}

export function loadMinefieldArchive() {
  return read<MinefieldSummary[]>(ARCHIVE_KEY, []);
}

export function loadMinefieldStats() {
  return read<MinefieldStats>(STATS_KEY, EMPTY_STATS);
}
