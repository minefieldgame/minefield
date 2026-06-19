import { DEV_SAMPLE_CHART } from "@/data/devSampleCharts";
import type { ChartSong } from "@/types/game";

const ROOT = "https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main";

type SourceChart = {
  date: string;
  data: Array<{ song: string; artist: string; this_week: number }>;
};

let validDatesCache: string[] | null = null;

async function getValidDates() {
  if (validDatesCache) return validDatesCache;
  const response = await fetch(`${ROOT}/valid_dates.json`, { next: { revalidate: 86400 } });
  if (!response.ok) throw new Error("Chart date index unavailable");
  validDatesCache = (await response.json()) as string[];
  return validDatesCache;
}

async function activeChartIssueDate(month: number, day: number, year: number) {
  const dates = (await getValidDates()).filter((date) => date.startsWith(`${year}-`));
  const target = Date.UTC(year, month - 1, day);
  const dated = dates
    .map((date) => ({ date, timestamp: Date.parse(`${date}T00:00:00Z`) }))
    .sort((a, b) => a.timestamp - b.timestamp);
  return [...dated].reverse().find((candidate) => candidate.timestamp <= target)?.date ?? "";
}

export async function getChartForDate(month: number, day: number, year: number) {
  const calendarDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  try {
    const sourceDate = await activeChartIssueDate(month, day, year);
    if (!sourceDate) throw new Error("No chart date found");
    const response = await fetch(`${ROOT}/date/${sourceDate}.json`, {
      next: { revalidate: 604800 }
    });
    if (!response.ok) throw new Error("Chart unavailable");
    const chart = (await response.json()) as SourceChart;
    return {
      date: calendarDate,
      sourceDate: chart.date,
      songs: chart.data.map((entry) => ({
        title: entry.song,
        artist: entry.artist,
        position: entry.this_week
      }))
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      return { ...DEV_SAMPLE_CHART, date: calendarDate, sourceDate: DEV_SAMPLE_CHART.date };
    }
    throw error;
  }
}

export async function getTopTenForDate(month: number, day: number, year: number) {
  const chart = await getChartForDate(month, day, year);
  return { ...chart, songs: chart.songs.filter((song) => song.position <= 10) };
}
