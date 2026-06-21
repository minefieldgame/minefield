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
  return dates
    .map((date) => ({
      date,
      distance: Math.abs(Date.parse(`${date}T00:00:00Z`) - target) / 86_400_000
    }))
    .filter((candidate) => candidate.distance <= 7)
    .sort((left, right) => left.distance - right.distance || left.date.localeCompare(right.date))[0]?.date ?? "";
}

export async function getChartForDate(month: number, day: number, year: number) {
  const calendarDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const sourceDate = await activeChartIssueDate(month, day, year);
  if (!sourceDate) throw new Error(`No chart date within 7 days of ${calendarDate}`);
  const response = await fetch(`${ROOT}/date/${sourceDate}.json`, {
    next: { revalidate: 604800 }
  });
  if (!response.ok) throw new Error(`Chart unavailable for ${sourceDate}`);
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
}

export async function getTopTenForDate(month: number, day: number, year: number) {
  const chart = await getChartForDate(month, day, year);
  return { ...chart, songs: chart.songs.filter((song) => song.position <= 10) };
}
