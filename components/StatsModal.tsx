"use client";

import { loadStats } from "@/lib/storage";

export default function StatsModal({ onClose }: { onClose: () => void }) {
  const stats = loadStats();
  const winRate = stats.gamesPlayed ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;
  const average = stats.gamesPlayed ? Math.round(stats.totalScore / stats.gamesPlayed) : 0;
  const maxGuess = Math.max(1, ...Object.values(stats.guessDistribution));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-5 backdrop-blur-md dark:bg-black/70">
      <section className="theme-surface w-full max-w-md rounded-[2rem] border p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-950 dark:text-white">Your stats</h2>
          <button aria-label="Close stats" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-slate-100 text-xl text-slate-700 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet/20 active:scale-90 dark:border-[#444b59] dark:bg-[#292e38] dark:text-white dark:hover:bg-[#353b47]">×</button>
        </div>
        <div className="mt-6 grid grid-cols-4 gap-2 text-center">
          {[
            [stats.gamesPlayed, "Played"],
            [`${winRate}%`, "Wins"],
            [stats.currentStreak, "Streak"],
            [stats.maxStreak, "Best"]
          ].map(([value, label]) => (
            <div key={label} className="theme-raised rounded-2xl border p-3 shadow-sm">
              <div className="text-xl font-black text-slate-950 dark:text-white">{value}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
            </div>
          ))}
        </div>
        <div className="theme-raised mt-5 flex justify-between rounded-2xl border p-4 text-sm text-slate-700 dark:text-slate-200">
          <span>Average score <b className="ml-1">{average}</b></span>
          <span>First listens <b className="ml-1">{stats.perfectGuesses}</b></span>
        </div>
        <h3 className="mb-3 mt-6 text-xs font-black uppercase tracking-[.15em] text-slate-500 dark:text-slate-300">Guess distribution</h3>
        <div className="space-y-2">
          {Object.entries(stats.guessDistribution).map(([attempt, count]) => (
            <div key={attempt} className="flex items-center gap-3 text-xs font-bold">
              <span className="w-3">{attempt}</span>
              <div className="h-7 min-w-8 rounded-md bg-violet px-2 py-1.5 text-right text-white shadow-sm dark:bg-[#7569e5]" style={{ width: `${Math.max(10, (count / maxGuess) * 92)}%` }}>
                {count}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
