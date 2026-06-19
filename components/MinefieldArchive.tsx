"use client";

import { useEffect, useState } from "react";
import { formatChartDate } from "@/lib/date";
import { loadMinefieldArchive } from "@/lib/minefieldStorage";
import type { MinefieldSummary } from "@/types/minefield";

export default function MinefieldArchive() {
  const [days, setDays] = useState<MinefieldSummary[]>([]);
  useEffect(() => setDays(loadMinefieldArchive()), []);

  if (!days.length) {
    return (
      <div className="theme-surface rounded-[2rem] border p-8 text-center">
        <div className="text-4xl">🗓️</div>
        <h2 className="mt-3 text-xl font-black text-slate-950 dark:text-white">No completed boards yet</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Finish today’s Minefield and it’ll appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {days.map((day) => (
        <article key={day.date} className="theme-surface rounded-[2rem] border p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{formatChartDate(day.date)}</p>
              <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">{day.gamesCompleted}/{day.totalGames} games complete</h2>
            </div>
            <span className="text-2xl font-black text-violet dark:text-[#9187f6]">{day.totalScore}</span>
          </div>
          <div className="mt-4 grid gap-2">
            {day.results.map((result) => (
              <div key={result.gameId} className="theme-raised flex items-center justify-between rounded-xl border px-3.5 py-2.5">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{result.displayName}</span>
                <span className="font-black text-slate-950 dark:text-white">{result.score}</span>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
