"use client";

import { useState } from "react";
import { formatChartDate } from "@/lib/date";
import { loadMinefieldStats } from "@/lib/minefieldStorage";
import type { MinefieldSummary } from "@/types/minefield";

export function buildMinefieldShare(summary: MinefieldSummary) {
  return [
    "Minefield Daily",
    formatChartDate(summary.date),
    "",
    ...summary.results.map((result) => `${result.displayName}: ${result.score}`),
    "",
    `Total: ${summary.totalScore}`,
    `${summary.gamesCompleted}/${summary.totalGames} Complete`,
    "",
    Array.from({ length: summary.totalGames }, (_, index) =>
      index < summary.gamesCompleted ? "🟩" : "⬜"
    ).join("")
  ].join("\n");
}

export default function DailySummary({ summary }: { summary: MinefieldSummary }) {
  const [copied, setCopied] = useState(false);
  const stats = loadMinefieldStats();

  async function copy() {
    await navigator.clipboard.writeText(buildMinefieldShare(summary));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="theme-surface w-full rounded-[2rem] border p-6 text-center sm:p-8">
      <p className="text-xs font-black uppercase tracking-[.2em] text-[#db4e36] dark:text-[#ff826a]">Daily board complete</p>
      <h2 className="mt-2 text-4xl font-black tracking-tight text-slate-950 dark:text-white">{summary.totalScore}</h2>
      <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">total Minefield points</p>
      <div className="mt-6 space-y-2">
        {summary.results.map((result) => (
          <div key={result.gameId} className="theme-raised flex items-center justify-between rounded-2xl border px-4 py-3 text-left">
            <div>
              <p className="font-extrabold text-slate-950 dark:text-white">{result.displayName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{result.detail}</p>
            </div>
            <span className="text-xl font-black text-violet dark:text-[#9187f6]">{result.score}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
        <span>🔥 {stats.currentStreak} day streak</span>
        <span>·</span>
        <span>{summary.gamesCompleted}/{summary.totalGames} complete</span>
      </div>
      <button onClick={copy} className="mt-6 w-full rounded-2xl bg-violet px-5 py-3.5 font-extrabold text-white shadow-lg shadow-violet/25 hover:bg-[#594dc8] active:scale-[.98] dark:bg-[#7569e5]">
        {copied ? "Copied!" : "Share daily result"}
      </button>
    </section>
  );
}
