"use client";

import { useState } from "react";
import { getGameCacheKey, getPacificDateKey } from "@/lib/date";
import type { AdminTopTenPreview as Preview } from "@/types/admin";

async function copyJson(value: unknown) {
  await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
}

function Datum({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="theme-raised rounded-xl border p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-1 break-words text-sm font-bold">{value}</div>
    </div>
  );
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
    return (
      <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
        <h2 className="text-2xl font-black">In Order</h2>
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">
          {preview.error || "In Order is unavailable."}
        </p>
        {preview.diagnostics && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Datum label="Generation status" value={preview.diagnostics.generationStatus} />
            <Datum label="Validation status" value={preview.diagnostics.validationStatus} />
            <Datum label="Route called" value={preview.diagnostics.resolverDiagnostics.route} />
            <Datum label="Resolver called" value={preview.diagnostics.resolverDiagnostics.resolver} />
            <Datum label="Date used" value={preview.diagnostics.resolverDiagnostics.date} />
            <Datum label="Cache key" value={preview.diagnostics.resolverDiagnostics.cacheKey} />
            <Datum label="Environment detected" value={String(preview.diagnostics.resolverDiagnostics.envDetected)} />
            <Datum label="Model" value={preview.diagnostics.resolverDiagnostics.model} />
            <Datum label="Error type" value={preview.diagnostics.resolverDiagnostics.errorType ?? "generation"} />
            <Datum label="Failure" value={preview.diagnostics.failureReason} />
            <Datum label="Errors" value={preview.diagnostics.errors.join(" | ")} />
          </div>
        )}
      </section>
    );
  }

  const { puzzle, diagnostics } = preview;
  return (
    <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-coral">Game diagnostics</p>
          <h2 className="mt-1 text-2xl font-black">In Order</h2>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">{diagnostics.validationStatus}</span>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Datum label="Selected date" value={date} />
        <Datum label="Current Pacific date" value={getPacificDateKey()} />
        <Datum label="Game cache key" value={getGameCacheKey("ranked-top-5", date)} />
        <Datum label="Cache hit" value={String(puzzle.cacheHit ?? false)} />
        <Datum label="Puzzle source" value={puzzle.cacheHit ? "server cache" : "generated fresh"} />
        <Datum label="Generated at" value={puzzle.generatedAt} />
        <Datum label="Content hash" value={puzzle.contentHash ?? "—"} />
        <Datum label="Generation duration" value={`${puzzle.generationDurationMs ?? 0} ms`} />
        <Datum label="Player prompt" value={puzzle.playerPrompt} />
        <Datum label="Admin prompt" value={puzzle.adminPrompt} />
        <Datum label="Category" value={puzzle.category} />
        <Datum label="Ranking metric" value={puzzle.rankingMetric} />
        <Datum label="Direction" value={puzzle.direction} />
        <Datum label="Confidence" value={`${Math.round(puzzle.confidence * 100)}%`} />
        <Datum label="Route called" value={diagnostics.resolverDiagnostics.route} />
        <Datum label="Resolver called" value={diagnostics.resolverDiagnostics.resolver} />
        <Datum label="Resolver date" value={diagnostics.resolverDiagnostics.date} />
        <Datum label="Game ID" value={diagnostics.resolverDiagnostics.gameId ?? "ranked-top-5"} />
        <Datum label="Daily seed" value={diagnostics.resolverDiagnostics.seed ?? "—"} />
        <Datum label="Temperature" value={diagnostics.resolverDiagnostics.temperature ?? 0} />
        <Datum label="Regenerated this session" value={String(diagnostics.resolverDiagnostics.regeneratedThisSession ?? false)} />
        <Datum label="Environment detected" value={String(diagnostics.resolverDiagnostics.envDetected)} />
        <Datum label="Model" value={diagnostics.resolverDiagnostics.model} />
      </div>

      <h3 className="mb-2 mt-6 text-xs font-black uppercase tracking-wider text-slate-500">Correct ranking</h3>
      <div className="space-y-1.5">
        {puzzle.answers.map((answer) => (
          <div key={answer.rank} className="theme-raised grid grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-xl border px-3 py-2">
            <span className="font-black text-violet">{answer.rank}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{answer.displayAnswer || answer.answer}</p>
              <p className="truncate text-[11px] text-slate-500">{answer.sourceNote}</p>
            </div>
            <span className="text-xs font-bold text-slate-500">{answer.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button onClick={() => copyJson(puzzle)} className="rounded-xl bg-violet px-3 py-3 text-sm font-extrabold text-white">Copy Puzzle JSON</button>
        <button onClick={onRegenerate} className="rounded-xl border px-3 py-3 text-sm font-extrabold">Generate In Order</button>
        <button onClick={onRetryCategory} className="rounded-xl border px-3 py-3 text-sm font-extrabold">Retry Category</button>
        <button onClick={() => setPlayerPreview((value) => !value)} className="rounded-xl border px-3 py-3 text-sm font-extrabold">Preview as Player</button>
      </div>

      {playerPreview && (
        <div className="mt-4 rounded-2xl border p-4">
          <p className="font-black">{puzzle.playerPrompt}</p>
          <div className="mt-3 space-y-1">
            {[...puzzle.answers].reverse().map((answer, index) => (
              <div key={answer.answer} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold dark:bg-[#292e38]">
                {index + 1}. {answer.displayAnswer || answer.answer}
              </div>
            ))}
          </div>
        </div>
      )}

      <details className="mt-5 rounded-xl border">
        <summary className="cursor-pointer px-4 py-3 font-extrabold">Raw AI response</summary>
        <pre className="max-h-80 overflow-auto border-t p-4 text-[11px]">{JSON.stringify(puzzle.rawAIResponse, null, 2)}</pre>
      </details>
      <details className="mt-2 rounded-xl border">
        <summary className="cursor-pointer px-4 py-3 font-extrabold">Final puzzle JSON</summary>
        <pre className="max-h-80 overflow-auto border-t p-4 text-[11px]">{JSON.stringify(puzzle, null, 2)}</pre>
      </details>
    </section>
  );
}
