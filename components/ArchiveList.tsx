"use client";

import { useEffect, useState } from "react";
import { formatChartDate } from "@/lib/date";
import { loadArchive } from "@/lib/storage";
import type { ArchiveEntry } from "@/types/game";

export default function ArchiveList() {
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  useEffect(() => setEntries(loadArchive()), []);

  if (!entries.length) {
    return (
      <div className="theme-surface rounded-[2rem] border p-8 text-center">
        <div className="text-4xl">💿</div>
        <h2 className="mt-3 text-xl font-black">Your crate is empty</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Finish a daily puzzle and it’ll appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <article key={entry.id} className="theme-surface flex items-center justify-between rounded-2xl border p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{formatChartDate(entry.chartDate)} · No. {entry.position}</p>
            <h2 className="mt-1 font-black text-slate-950 dark:text-white">{entry.title}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">{entry.artist}</p>
          </div>
          <div className={`rounded-full px-3 py-1.5 text-xs font-black ${entry.status === "won" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-600 dark:text-red-300"}`}>
            {entry.score}
          </div>
        </article>
      ))}
    </div>
  );
}
