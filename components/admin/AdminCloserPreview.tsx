"use client";

import { useState } from "react";
import type { AdminCloserPreview as Preview } from "@/types/admin";
import { getGameCacheKey, getPacificDateKey } from "@/lib/date";
import { calculateCloserScore, parseNumericGuess } from "@/games/closer/providers";

export default function AdminCloserPreview({ preview, date, onRegenerate }: { preview: Preview; date: string; onRegenerate: () => void }) {
  const [testGuess, setTestGuess] = useState("");
  if (preview.status === "error") return (
    <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
      <h2 className="text-2xl font-black">In the Ballpark</h2>
      <p className="mt-3 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">{preview.error}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {[
          ["Generation status", preview.diagnostics.generationStatus],
          ["Validation status", preview.diagnostics.validationStatus],
          ["Route called", preview.diagnostics.resolverDiagnostics.route],
          ["Resolver called", preview.diagnostics.resolverDiagnostics.resolver],
          ["Date used", preview.diagnostics.resolverDiagnostics.date],
          ["Cache key", preview.diagnostics.resolverDiagnostics.cacheKey],
          ["Error type", preview.diagnostics.resolverDiagnostics.errorType ?? "generation"],
          ["OPENAI_API_KEY detected", String(preview.diagnostics.apiKeyConfigured)],
          ["Live generation enabled", String(preview.diagnostics.liveGenerationEnabled)],
          ["Fallback usage", preview.diagnostics.fallbackUsed ? "Used" : "None"],
          ["Content hash", preview.diagnostics.contentHash ?? "Not generated"],
          ["Source data", preview.diagnostics.sourceData.join(", ") || "None"],
          ["Generation errors", preview.diagnostics.errors.join(" | ")]
        ].map(([label, value]) => <div key={label} className="theme-raised rounded-xl border p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-bold">{value}</p></div>)}
      </div>
    </section>
  );
  const { puzzle } = preview;
  const numericGuess = parseNumericGuess(testGuess);
  const score = numericGuess === null ? null : calculateCloserScore(numericGuess, puzzle.answer, puzzle.scoringProfile);
  return (
    <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
      <div className="flex items-center justify-between"><h2 className="text-2xl font-black">In the Ballpark</h2><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">valid</span></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {[
          ["Selected date", date],
          ["Current Pacific date", getPacificDateKey()],
          ["Game cache key", getGameCacheKey("closer", date)],
          ["Route called", preview.diagnostics.route],
          ["Resolver called", preview.diagnostics.resolver],
          ["Resolver date", preview.diagnostics.date],
          ["Environment detected", String(preview.diagnostics.envDetected)],
          ["Model", preview.diagnostics.model],
          ["Game ID", preview.diagnostics.gameId ?? "closer"],
          ["Date key", preview.diagnostics.dateKey ?? date],
          ["Daily seed", preview.diagnostics.seed ?? puzzle.seed],
          ["Temperature", preview.diagnostics.temperature ?? 0],
          ["Regenerated this session", String(preview.diagnostics.regeneratedThisSession ?? false)],
          ["Generated prompt", puzzle.prompt], ["Answer", puzzle.displayAnswer], ["Unit", puzzle.unit],
          ["Scoring profile", puzzle.scoringProfile], ["Tolerance type", puzzle.toleranceType],
          ["Source note", puzzle.sourceNote], ["Generator", preview.generator],
          ["Model used", preview.generator.match(/\(([^)]+)\)/)?.[1] ?? "Configured model"],
          ["Cache hit", String(preview.cacheHit)],
          ["Puzzle source", preview.cacheHit ? "server cache" : "generated fresh"],
          ["Generated at", preview.generatedAt],
          ["Generation duration", `${preview.generationDurationMs} ms`],
          ["Confidence", `${Math.round(preview.confidence * 100)}%`],
          ["Content hash", preview.contentHash],
          ["Repeat check", preview.repeatCheck.repeated ? "Recently appeared" : "Clear"]
        ].map(([label, value]) => <div key={label} className="theme-raised rounded-xl border p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-bold">{value}</p></div>)}
      </div>
      <div className="theme-raised mt-4 rounded-2xl border p-4">
        <label className="text-xs font-black uppercase tracking-wider text-slate-500">Test scoring diagnostics</label>
        <input value={testGuess} onChange={(event) => setTestGuess(event.target.value)} inputMode="decimal" placeholder="Enter a test guess" className="mt-2 h-11 w-full rounded-xl border bg-transparent px-3 font-bold" />
        {score && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ["Guess", numericGuess!], ["Absolute difference", score.distanceFromAnswer],
              ["Percent error", `${(score.percentError * 100).toFixed(2)}%`],
              ["Profile", score.scoringProfile], ["Final score", `${score.score} · ${score.scoreLabel}`]
            ].map(([label, value]) => <div key={label} className="rounded-xl bg-black/[.04] p-2 dark:bg-white/[.05]"><p className="text-[9px] font-black uppercase text-slate-500">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>)}
          </div>
        )}
      </div>
      <button onClick={onRegenerate} className="mt-4 rounded-xl bg-violet px-5 py-3 text-sm font-extrabold text-white">Generate In the Ballpark</button>
      <details className="mt-3 rounded-xl border"><summary className="cursor-pointer px-4 py-3 font-extrabold">Raw AI response</summary><pre className="max-h-80 overflow-auto border-t p-4 text-[11px]">{JSON.stringify(preview.rawAIResponse, null, 2)}</pre></details>
      <details className="mt-2 rounded-xl border"><summary className="cursor-pointer px-4 py-3 font-extrabold">Final puzzle JSON</summary><pre className="max-h-80 overflow-auto border-t p-4 text-[11px]">{JSON.stringify(puzzle, null, 2)}</pre></details>
    </section>
  );
}
