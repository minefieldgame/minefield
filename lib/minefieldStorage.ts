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
  return read(`${BOARD_PREFIX}${date}`, { date, results: {} });
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
  totalGames = 2
): MinefieldSummary {
  const results = Object.values(board.results).filter(Boolean) as MinefieldGameResult[];
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

export function completeDailyBoard(board: MinefieldDailyBoard, totalGames = 2) {
  const summary = calculateDailySummary(board, totalGames);
  if (summary.gamesCompleted < totalGames) return summary;

  const archived = read<MinefieldSummary[]>(ARCHIVE_KEY, []);
  if (!archived.some((entry) => entry.date === board.date)) {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify([summary, ...archived].slice(0, 180)));
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
