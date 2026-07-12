"use client";

import type { AdminVaultbreakPreview as Preview } from "@/types/admin";

function Datum({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="theme-raised min-w-0 rounded-xl border p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-1 break-words text-sm font-bold text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}

export default function AdminVaultbreakPreview({
  preview,
  onRegenerate
}: {
  preview: Preview;
  onRegenerate: () => void;
}) {
  if (preview.status === "error") {
    return (
      <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black">Vaultbreak</h2>
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700 dark:bg-red-400/10 dark:text-red-200">Failed</span>
        </div>
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">{preview.error}</p>
      </section>
    );
  }

  const { puzzle, diagnostics } = preview;
  return (
    <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#db4e36] dark:text-[#ff826a]">Game diagnostics</p>
          <h2 className="mt-1 text-2xl font-black">Vaultbreak</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">Deterministic 5,040-code solver · secret withheld from player GET payload</p>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">{diagnostics.status}</span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Datum label="Selected date" value={diagnostics.selectedDate} />
        <Datum label="Cache key" value={diagnostics.cacheKey} />
        <Datum label="Content hash" value={diagnostics.contentHash} />
        <Datum label="Difficulty" value={diagnostics.difficulty} />
        <Datum label="Secret code" value={<span className="font-mono text-xl tracking-[.25em]">{diagnostics.secretCode}</span>} />
        <Datum label="Clue count" value={diagnostics.clueCount} />
        <Datum label="Initial candidates" value={diagnostics.initialCandidateCount.toLocaleString()} />
        <Datum label="Final solution count" value={diagnostics.finalSolutionCount} />
        <Datum label="Difficulty score" value={`${diagnostics.estimatedDifficultyScore}/100`} />
        <Datum label="Generator seed" value={diagnostics.generatorSeed} />
        <Datum label="Generation attempts" value={diagnostics.generationAttempts} />
        <Datum label="365-day generator baseline" value={`${diagnostics.proceduralBaseline.validGeneratedPuzzles}/${diagnostics.proceduralBaseline.sampleDays} valid · ${diagnostics.proceduralBaseline.averageGenerationAttempts.toFixed(3)} average attempts · max ${diagnostics.proceduralBaseline.maximumGenerationAttemptsObserved}`} />
        <Datum label="Expected max score" value={`${puzzle.scoring.maximumScore} · no time limit`} />
        <Datum label="Exact duplicate" value={diagnostics.exactDuplicateStatus} />
        <Datum label="Cooldown" value={`${diagnostics.cooldownStatus} · code ${diagnostics.secretCodeCooldownDays}d · pattern ${diagnostics.cluePatternCooldownDays}d`} />
        <Datum label="Collision retries" value={`${diagnostics.exactCollisionRetries} exact · ${diagnostics.cooldownCollisions} cooldown`} />
        <Datum label="DynamoDB R/W" value={`${diagnostics.dynamoDbReads}/${diagnostics.dynamoDbWrites} (${diagnostics.dynamoDbKeysRead} keys)`} />
        <Datum label="Generation duration" value={`${diagnostics.generationDurationMs} ms`} />
        <Datum label="Clue type distribution" value={Object.entries(puzzle.diagnostics.clueTypeDistribution).filter(([, count]) => count).map(([type, count]) => `${type}: ${count}`).join(" · ")} />
      </div>

      <h3 className="mb-2 mt-6 text-xs font-black uppercase tracking-[.16em] text-slate-500 dark:text-slate-300">Clues and solver elimination</h3>
      <div className="space-y-2">
        {puzzle.clues.map((clue, index) => {
          const step = diagnostics.remainingCandidatesAfterEachClue[index];
          return (
            <div key={clue.id} className="theme-raised flex min-w-0 items-start justify-between gap-4 rounded-xl border p-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-bold">{index + 1}. {clue.text}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{clue.category} · {clue.type}</p>
              </div>
              <span className="shrink-0 rounded-full bg-violet/10 px-2.5 py-1 text-xs font-black text-violet dark:text-[#aaa2ff]">{step?.before.toLocaleString()} → {step?.remaining.toLocaleString()}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 p-4 dark:border-[#3b424f]">
        <h3 className="text-xs font-black uppercase tracking-[.16em] text-slate-500 dark:text-slate-300">Scoring</h3>
        <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">10 per exact slot · 40 solve bonus · speed +20/&lt;60s, +15/&lt;2m, +10/&lt;4m, +5/&lt;8m · maximum 100 · no timeout failure</p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => navigator.clipboard.writeText(JSON.stringify(puzzle, null, 2))} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 dark:border-[#454c5a] dark:bg-[#292e38] dark:text-white">Copy puzzle JSON</button>
        <button type="button" onClick={onRegenerate} className="rounded-xl bg-violet px-4 py-3 text-sm font-extrabold text-white dark:bg-[#7569e5]">Regenerate puzzle</button>
      </div>
      <details className="mt-3 rounded-xl border border-slate-200 dark:border-[#3b424f]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">Raw JSON</summary>
        <pre className="max-h-96 overflow-auto border-t border-slate-200 p-4 text-[11px] dark:border-[#3b424f]">{JSON.stringify(puzzle, null, 2)}</pre>
      </details>
    </section>
  );
}
