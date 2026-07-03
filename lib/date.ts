import { GAME_VERSIONS, getGameSeedForDate, type SeededGameId } from "@/lib/dailySeed";

const TIME_ZONE = "America/Los_Angeles";
export type PacificDate = {
  year: number;
  month: number;
  day: number;
  dateKey: string;
};

export function getPacificToday(date = new Date()): PacificDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const year = value("year");
  const month = value("month");
  const day = value("day");
  return {
    year,
    month,
    day,
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  };
}

export function getPacificMonthDay(date = new Date()) {
  const { month, day } = getPacificToday(date);
  return { month, day };
}

export function getDailySeed(date = new Date()) {
  return getGameSeedForDate(getPacificToday(date).dateKey, "needledrop");
}

export function getPacificDateParts(date = new Date()) {
  const { year, month, day } = getPacificToday(date);
  return { year, month, day };
}

export function getPacificDateKey(date = new Date()) {
  return getPacificToday(date).dateKey;
}

export function getDailyGameDate(date = new Date()) {
  return getPacificDateKey(date);
}

export function getGameCacheKey(gameId: string, dateKey: string, scope?: string) {
  const version = Object.prototype.hasOwnProperty.call(GAME_VERSIONS, gameId)
    ? GAME_VERSIONS[gameId as SeededGameId]
    : "";
  const base = version ? `${gameId}:${dateKey}:${version}` : `${gameId}:${dateKey}`;
  return scope ? `${gameId}:${scope}:${dateKey}${version ? `:${version}` : ""}` : base;
}

export function getBoardCacheKey(dateKey: string, scope?: string) {
  return getGameCacheKey("minefield-board", dateKey, scope);
}

export function isTodayPacific(dateKey: string, now = new Date()) {
  return dateKey === getPacificDateKey(now);
}

export function buildCalendarDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatChartDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00Z`));
}

export function puzzleNumber(dateKey: string) {
  const epoch = Date.UTC(2026, 0, 1);
  const current = Date.parse(`${dateKey}T00:00:00Z`);
  return Math.max(1, Math.floor((current - epoch) / 86400000) + 1);
}
