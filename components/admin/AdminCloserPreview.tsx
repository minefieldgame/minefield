"use client";

import type { AdminCloserPreview as Preview } from "@/types/admin";

export default function AdminCloserPreview({
  preview,
  onRegenerate
}: {
  preview: Preview;
  onRegenerate: () => void;
}) {
  async function copy() {
    await navigator.clipboard.writeText(JSON.stringify(preview.puzzle, null, 2));
  }
  const puzzle = preview.puzzle;
  return (
    <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
      <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#db4e36] dark:text-[#ff826a]">Game diagnostics</p>
      <div className="flex items-center justify-between">
        <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Closer</h2>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">{preview.validation.valid ? "valid" : "invalid"}</span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {[
          ["Selected date", puzzle.date],
          ["Daily seed", puzzle.seed],
          ["Question ID", puzzle.id],
          ["Category", puzzle.category],
          ["Prompt", puzzle.prompt],
          ["Answer", puzzle.displayAnswer],
          ["Unit", puzzle.unit],
          ["Source note", puzzle.sourceNote],
          ["Question pool", `${preview.questionPoolSize} verified templates`]
        ].map(([label, value]) => (
          <div key={label} className="theme-raised rounded-xl border p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-1 text-sm font-bold text-slate-950 dark:text-white">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={onRegenerate} className="rounded-xl bg-violet px-4 py-3 text-sm font-extrabold text-white">Generate Closer</button>
        <button onClick={copy} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-extrabold dark:border-[#454c5a] dark:bg-[#292e38]">Copy JSON</button>
      </div>
      <details className="mt-3 rounded-xl border border-slate-200 dark:border-[#3b424f]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">Raw puzzle JSON</summary>
        <pre className="max-h-80 overflow-auto border-t p-4 text-[11px]">{JSON.stringify(puzzle, null, 2)}</pre>
      </details>
    </section>
  );
}
