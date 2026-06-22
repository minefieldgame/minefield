"use client";

import type { AdminMinefieldPreview as Preview } from "@/types/admin";

export default function AdminMinefieldPreview({
  preview,
  onRegenerate
}: {
  preview: Preview;
  onRegenerate: () => void;
}) {
  async function copy() {
    await navigator.clipboard.writeText(JSON.stringify(preview.puzzle, null, 2));
  }
  return (
    <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
      <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#db4e36] dark:text-[#ff826a]">Game diagnostics</p>
      <div className="flex items-center justify-between">
        <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Minefield</h2>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">Deterministic</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Selected date", preview.puzzle.date],
          ["Daily seed", preview.puzzle.seed],
          ["Difficulty preview", preview.puzzle.difficulty],
          ["Run score preview", `${preview.puzzle.runScore}/${preview.puzzle.runMaxScore}`],
          ["Mine count", preview.puzzle.mineCount],
          ["Required safe picks", preview.puzzle.maxPicks],
          ["Mine positions", preview.puzzle.minePositions.map((value) => value + 1).join(", ")]
        ].map(([label, value]) => (
          <div key={label} className="theme-raised rounded-xl border p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-1 text-sm font-bold text-slate-950 dark:text-white">{value}</p>
          </div>
        ))}
      </div>
      <div
        className="mx-auto mt-4 grid max-w-[340px] grid-cols-5 gap-2"
      >
        {Array.from({ length: preview.puzzle.gridSize ** 2 }, (_, index) => (
          <div key={index} className={`grid aspect-square place-items-center rounded-md border text-sm ${preview.puzzle.minePositions.includes(index) ? "border-red-500 bg-red-500 text-white" : "border-slate-200 bg-slate-100 dark:border-[#454c5a] dark:bg-[#292e38]"}`}>
            {preview.puzzle.minePositions.includes(index) ? "💣" : index + 1}
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={onRegenerate} className="rounded-xl bg-violet px-4 py-3 text-sm font-extrabold text-white">Generate Minefield</button>
        <button onClick={copy} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-extrabold dark:border-[#454c5a] dark:bg-[#292e38]">Copy JSON</button>
      </div>
      <details className="mt-3 rounded-xl border border-slate-200 dark:border-[#3b424f]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">Raw puzzle JSON</summary>
        <pre className="max-h-80 overflow-auto border-t p-4 text-[11px]">{JSON.stringify(preview.puzzle, null, 2)}</pre>
      </details>
    </section>
  );
}
