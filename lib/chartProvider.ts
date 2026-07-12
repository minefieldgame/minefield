const ROOT = "https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main";

type SourceChart = {
  date: string;
  data: Array<{ song: string; artist: string; this_week: number }>;
};

let validDatesCache: string[] | null = null;
let validDatesRequest: Promise<string[]> | null = null;

export function historicalChartAnchorDate(puzzleDate: string, historicalYear: number) {
  const [, month, selectedDay] = puzzleDate.split("-").map(Number);
  const lastDay = new Date(Date.UTC(historicalYear, month, 0)).getUTCDate();
  const day = Math.min(selectedDay, lastDay);
  return `${historicalYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function getValidDates() {
  if (validDatesCache) return validDatesCache;
  if (validDatesRequest) return validDatesRequest;
  validDatesRequest = (async () => {
    const response = await fetch(`${ROOT}/valid_dates.json`, { next: { revalidate: 86400 } });
    if (!response.ok) throw new Error("Chart date index unavailable");
    validDatesCache = (await response.json()) as string[];
    return validDatesCache;
  })();
  try {
    return await validDatesRequest;
  } finally {
    // Successful requests are served from validDatesCache; failures may retry.
    validDatesRequest = null;
  }
}

export async function nearestChartIssueDate(month: number, day: number, year: number, maxWindowDays = 14) {
  const dates = (await getValidDates()).filter((date) => {
    const issueYear = Number(date.slice(0, 4));
    return Math.abs(issueYear - year) <= 1;
  });
  const target = Date.UTC(year, month - 1, day);
  return dates
    .map((date) => ({
      date,
      distance: Math.abs(Date.parse(`${date}T00:00:00Z`) - target) / 86_400_000
    }))
    .filter((candidate) => candidate.distance <= Math.min(14, Math.max(1, maxWindowDays)))
    .sort((left, right) => left.distance - right.distance || left.date.localeCompare(right.date))[0] ?? null;
}

export function chartIssueDeltaDays(requestedDate: string, resolvedDate: string) {
  return Math.abs(Date.parse(`${resolvedDate}T00:00:00Z`) - Date.parse(`${requestedDate}T00:00:00Z`)) / 86_400_000;
}

export function isChartIssueAnchoredToDate(requestedDate: string, resolvedDate: string, maxWindowDays = 14) {
  const delta = chartIssueDeltaDays(requestedDate, resolvedDate);
  return Number.isFinite(delta) && delta <= Math.min(14, Math.max(1, maxWindowDays));
}

export async function getChartForDate(month: number, day: number, year: number, options: { maxWindowDays?: number } = {}) {
  const calendarDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const issue = await nearestChartIssueDate(month, day, year, options.maxWindowDays ?? 14);
  if (!issue) throw new Error(`No chart date within ${Math.min(14, options.maxWindowDays ?? 14)} days of ${calendarDate}`);
  const response = await fetch(`${ROOT}/date/${issue.date}.json`, {
    next: { revalidate: 604800 }
  });
  if (!response.ok) throw new Error(`Chart unavailable for ${issue.date}`);
  const chart = (await response.json()) as SourceChart;
  return {
    date: calendarDate,
    sourceDate: chart.date,
    dateDeltaDays: issue.distance,
    fallbackWindowDays: issue.distance <= 7 ? 7 : 14,
    songs: chart.data.map((entry) => ({
      title: entry.song,
      artist: entry.artist,
      position: entry.this_week
    }))
  };
}

export async function getTopTenForDate(month: number, day: number, year: number) {
  const chart = await getChartForDate(month, day, year);
  return { ...chart, songs: chart.songs.filter((song) => song.position <= 10) };
}
