"use client";

import { useState } from "react";
import { hashString } from "@/lib/dailySeed";
import type { AdminTopTenPreview as Preview } from "@/types/admin";

async function copyJson(value: unknown) {
  await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
}

export default function AdminTopTenPreview({
  preview,
  date,
  onRegenerate,
  onRetryCategory
}: {
  preview: Preview;
  date: string;
  onRegenerate: () => void;
  onRetryCategory: () => void;
}) {
  const [playerPreview, setPlayerPreview] = useState(false);
  if (preview.status === "error") {
    const diagnostics = preview.diagnostics;
    return (
      <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
        <h2 className="text-2xl font-black text-slate-950 dark:text-white">Top 10</h2>
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">{preview.error || "Top 10 not installed."}</p>
        {diagnostics && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              ["OPENAI_API_KEY", diagnostics.apiKeyConfigured ? "Detected" : "Missing"],
              ["Live AI generation", diagnostics.liveAIEnabled ? "Enabled" : "Disabled"],
              ["Generation mode", diagnostics.generationMode],
              ["Model", diagnostics.model],
              ["Exact failure", diagnostics.failureReason]
            ].map(([label, value]) => (
              <div key={label} className="theme-raised rounded-xl border p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-1 break-words text-sm font-bold text-slate-950 dark:text-white">{value}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  const { puzzle, diagnostics } = preview;
  const rawAI = puzzle.rawAIResponse as
    | { category?: unknown; resolution?: unknown }
    | undefined;
  return (
    <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#db4e36] dark:text-[#ff826a]">Game diagnostics</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Top 10</h2>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">{diagnostics.validationStatus}</span>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {[
          ["Game date", puzzle.date],
          ["Daily seed", hashString(`minefield:top-ten:${date}`)],
          ["Selected category", puzzle.category.title],
          ["Topic area", puzzle.category.topicArea],
          ["Ranking metric", puzzle.category.rankingMetric],
          ["Answer type", puzzle.category.expectedAnswerType],
          ["Source strategy", puzzle.category.sourceStrategy]
        ].map(([label, value]) => (
          <div key={label} className="theme-raised rounded-xl border p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-1 text-sm font-bold text-slate-950 dark:text-white">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl bg-violet/10 p-4 dark:bg-violet/20">
        <p className="text-xs font-black uppercase tracking-wider text-violet dark:text-[#aaa2ff]">Prompt</p>
        <p className="mt-1 text-lg font-black text-slate-950 dark:text-white">{puzzle.category.prompt}</p>
      </div>

      <h3 className="mb-3 mt-6 text-xs font-black uppercase tracking-[.16em] text-slate-500 dark:text-slate-300">All answers and aliases</h3>
      <div className="space-y-2">
        {puzzle.answers.map((answer) => (
          <div key={answer.rank} className="theme-raised rounded-xl border p-3">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-violet text-xs font-black text-white dark:bg-[#7569e5]">{answer.rank}</span>
              <div>
                <p className="font-black text-slate-950 dark:text-white">{answer.name}</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{answer.aliases.join(" · ") || "No additional aliases"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {diagnostics.warning && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
          {diagnostics.warning}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button onClick={() => copyJson(puzzle)} className="rounded-xl bg-violet px-3 py-3 text-sm font-extrabold text-white dark:bg-[#7569e5]">Copy Puzzle JSON</button>
        <button onClick={() => navigator.clipboard.writeText(puzzle.category.prompt)} className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-extrabold text-slate-700 dark:border-[#454c5a] dark:bg-[#292e38] dark:text-white">Copy Prompt</button>
        <button onClick={onRegenerate} className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-extrabold text-slate-700 dark:border-[#454c5a] dark:bg-[#292e38] dark:text-white">Generate Top 10</button>
        <button onClick={onRetryCategory} className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-extrabold text-slate-700 dark:border-[#454c5a] dark:bg-[#292e38] dark:text-white">Retry Category</button>
        <button onClick={() => setPlayerPreview((value) => !value)} className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-extrabold text-slate-700 dark:border-[#454c5a] dark:bg-[#292e38] dark:text-white">Preview as Player</button>
      </div>

      {playerPreview && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-[#3b424f] dark:bg-[#20242c]">
          <span className="rounded-full bg-violet/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-violet dark:bg-violet/25 dark:text-[#aaa2ff]">{puzzle.category.topicArea}</span>
          <h3 className="mt-3 text-xl font-black text-slate-950 dark:text-white">{puzzle.category.prompt}</h3>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {Array.from({ length: 10 }, (_, index) => (
              <div key={index} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-400 dark:border-[#343a47] dark:bg-[#252a34] dark:text-slate-500">
                {index + 1} —
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {[
          ["Source provider", diagnostics.sourceProvider],
          ["Validation", diagnostics.validationStatus],
          ["Data freshness", diagnostics.dataFreshness]
          ,["Confidence", `${Math.round(diagnostics.confidence * 100)}%`]
          ,["Generation mode", diagnostics.generationMode]
          ,["API key", diagnostics.apiKeyConfigured ? "Configured" : "Missing"]
        ].map(([label, value]) => (
          <div key={label} className="theme-raised rounded-xl border p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-1 text-sm font-bold text-slate-950 dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      <details className="mt-5 rounded-xl border border-slate-200 dark:border-[#3b424f]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">Raw puzzle JSON</summary>
        <pre className="max-h-80 overflow-auto border-t border-slate-200 p-4 text-[11px] dark:border-[#3b424f]">{JSON.stringify(puzzle, null, 2)}</pre>
      </details>
      <details className="mt-2 rounded-xl border border-slate-200 dark:border-[#3b424f]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">Raw AI category response</summary>
        <pre className="max-h-80 overflow-auto border-t border-slate-200 p-4 text-[11px] dark:border-[#3b424f]">{JSON.stringify(rawAI?.category ?? null, null, 2)}</pre>
      </details>
      <details className="mt-2 rounded-xl border border-slate-200 dark:border-[#3b424f]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">Raw answer resolver response</summary>
        <pre className="max-h-80 overflow-auto border-t border-slate-200 p-4 text-[11px] dark:border-[#3b424f]">{JSON.stringify(rawAI?.resolution ?? null, null, 2)}</pre>
      </details>
      <details className="mt-2 rounded-xl border border-slate-200 dark:border-[#3b424f]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">Raw provider response</summary>
        <pre className="max-h-80 overflow-auto border-t border-slate-200 p-4 text-[11px] dark:border-[#3b424f]">{JSON.stringify(preview.rawProviderResponse, null, 2)}</pre>
      </details>
      <button onClick={() => copyJson(preview.rawProviderResponse)} className="mt-2 w-full rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-extrabold text-slate-700 dark:bg-[#292e38] dark:text-white">Copy Provider JSON</button>
    </section>
  );
}
