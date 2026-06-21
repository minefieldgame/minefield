"use client";

import Link from "next/link";
import { formatChartDate } from "@/lib/date";
import { loadMinefieldStats } from "@/lib/minefieldStorage";
import type { MinefieldSummary } from "@/types/minefield";

export function buildMinefieldShare(summary: MinefieldSummary) {
  return [
    "Minefield Daily",
    formatChartDate(summary.date),
    "",
    `Score: ${summary.totalScore} / ${summary.maxScore}`,
    "",
    ...summary.results.map((result) => result.shareLine),
    "",
    `${summary.results.length} games played`,
    "Play: https://minefieldgame.com",
    "",
    "No spoilers."
  ].join("\n");
}

export default function DailySummary({ summary }: { summary: MinefieldSummary }) {
  const stats = loadMinefieldStats();
  return (
    <section className="theme-surface w-full rounded-[1.5rem] border p-5 text-center sm:p-6">
      <p className="text-xs font-black uppercase tracking-[.2em] text-[#db4e36] dark:text-[#ff826a]">Daily Board Complete</p>
      <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-300">{formatChartDate(summary.date)}</p>
      <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
        {summary.totalScore} <span className="text-lg text-slate-400">/ {summary.maxScore}</span>
      </h2>
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">{summary.results.length} games played</p>

      <div className="mt-4 space-y-2">
        {summary.results.map((result) => (
          <div key={result.gameId} className="theme-raised flex items-center justify-between rounded-xl border px-3 py-2.5 text-left">
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-xl" aria-hidden="true">{result.icon}</span>
              <div className="min-w-0">
                <p className="font-extrabold text-slate-950 dark:text-white">{result.displayName}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{result.summaryLabel}</p>
              </div>
            </div>
            <span className="shrink-0 text-lg font-black text-violet dark:text-[#9187f6]">{result.score}/{result.maxScore}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 text-sm font-bold text-slate-600 dark:text-slate-300">🔥 {stats.currentStreak} day streak</div>
      <div className="mt-4 grid gap-2">
        <Link href={`/review?date=${summary.date}`} className="w-full rounded-xl bg-violet px-5 py-3 font-extrabold text-white shadow-lg shadow-violet/25 active:scale-[.98] dark:bg-[#7569e5]">
          Review Daily Answers
        </Link>
        <p className="px-3 py-2 text-sm font-semibold text-slate-500 dark:text-slate-300">
          New daily board available at midnight Pacific.
        </p>
      </div>
    </section>
  );
}
