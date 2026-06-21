import type { ArchiveEntry, GameState, Stats } from "@/types/game";
import { getGameCacheKey } from "@/lib/date";

const STATS_KEY = "needledrop:stats";
const ARCHIVE_KEY = "needledrop:archive";

export const EMPTY_STATS: Stats = {
  gamesPlayed: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  totalScore: 0,
  perfectGuesses: 0,
  guessDistribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0 }
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function gameKey(dateKey: string, scope?: string) {
  return getGameCacheKey("needledrop", dateKey, scope);
}

export function loadGame(dateKey: string, scope?: string) {
  return read<GameState | null>(gameKey(dateKey, scope), null);
}

export function saveGame(state: GameState, scope?: string) {
  localStorage.setItem(gameKey(state.puzzle.puzzleDate, scope), JSON.stringify(state));
}

export function loadStats() {
  return read<Stats>(STATS_KEY, EMPTY_STATS);
}

export function saveStats(stats: Stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function loadArchive() {
  return read<ArchiveEntry[]>(ARCHIVE_KEY, []);
}

export function saveArchive(entries: ArchiveEntry[]) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(entries));
}
