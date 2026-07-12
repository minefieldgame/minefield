"use client";

import { useState } from "react";
import type { OddOneOutPuzzle } from "@/games/odd-one-out/types";

export type AdminOddOneOutPreviewData =
  | {
      status: "ready";
      puzzle: OddOneOutPuzzle;
      diagnostics?: {
        selectedDate?: string;
        cacheKey?: string;
        status?: string;
        contentHash?: string;
        selectedCandidateId?: string;
        sourceStrategy?: string;
        sourceGenerationStrategy?: string;
        exactDuplicateStatus?: string;
        cooldownStatus?: string;
        inventoryTotal?: number;
        eligibleInventory?: number;
        unusedEligibleInventory?: number;
        rejectedCandidates?: number;
        dynamoDbReads?: number;
        dynamoDbWrites?: number;
        generationDurationMs?: number;
        duplicateCheck?: { passed?: boolean; duplicateDetected?: boolean; retryCount?: number };
      };
    }
  | { status: "error"; error: string };

export default function AdminOddOneOutPreview({
  preview,
  onRegenerate
}: {
  preview?: AdminOddOneOutPreviewData;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!preview) {
    return (
      <section className="theme-surface rounded-[2rem] border border-amber-200 p-5 sm:p-6 dark:border-amber-400/20">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black">Odd One Out</h2>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">Pending</span>
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">Preview data was not included in this response.</p>
      </section>
    );
  }

  if (preview.status === "error") {
    return (
      <section className="theme-surface rounded-[2rem] border border-red-200 p-5 sm:p-6 dark:border-red-400/20">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black">Odd One Out</h2>
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700 dark:bg-red-400/10 dark:text-red-200">Failed</span>
        </div>
        <p className="mt-2 text-sm font-bold text-red-600 dark:text-red-300">{preview.error}</p>
        <button onClick={onRegenerate} className="mt-4 rounded-xl bg-violet px-4 py-3 text-sm font-extrabold text-white">Regenerate puzzle</button>
      </section>
    );
  }

  const { puzzle, diagnostics = {} } = preview;
  const fields: Array<[string, string | number]> = [
    ["Selected date", diagnostics.selectedDate ?? puzzle.date],
    ["Selected candidate", diagnostics.selectedCandidateId ?? puzzle.id],
    ["Category family", puzzle.category],
    ["Difficulty", puzzle.difficulty],
    ["Quality score", puzzle.qualityScore ?? "Not reported"],
    ["Recognizability", puzzle.recognizabilityScore ?? "Not reported"],
    ["Status", diagnostics.status ?? "Ready"],
    ["Cache key", diagnostics.cacheKey ?? "Not reported"],
    ["Content hash", diagnostics.contentHash ?? puzzle.contentHash ?? "Not reported"],
    ["Exact duplicate", diagnostics.exactDuplicateStatus ?? (diagnostics.duplicateCheck?.passed ? "Passed" : "Not reported")],
    ["Cooldown", diagnostics.cooldownStatus ?? "Not reported"],
    ["Inventory total", diagnostics.inventoryTotal ?? "Not reported"],
    ["Eligible inventory", diagnostics.eligibleInventory ?? "Not reported"],
    ["Unused eligible", diagnostics.unusedEligibleInventory ?? "Not reported"],
    ["Rejected", diagnostics.rejectedCandidates ?? "Not reported"],
    ["Source strategy", diagnostics.sourceStrategy ?? diagnostics.sourceGenerationStrategy ?? puzzle.sourceNote ?? "Project-authored prepared inventory"],
    ["DynamoDB reads / writes", `${diagnostics.dynamoDbReads ?? 0} / ${diagnostics.dynamoDbWrites ?? 0}`],
    ["Generation duration", diagnostics.generationDurationMs === undefined ? "Not reported" : `${diagnostics.generationDurationMs} ms`]
  ];

  async function copyPuzzle() {
    await navigator.clipboard.writeText(JSON.stringify(puzzle, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  }

  return (
    <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-black">Odd One Out</h2>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">Ready</span>
      </div>

      <p className="mt-4 text-lg font-black text-slate-950 dark:text-white">{puzzle.prompt}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {puzzle.items.map((item) => (
          <div key={item} className={`rounded-xl border p-3 text-sm font-bold ${
            item === puzzle.answer
              ? "border-emerald-300 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : "theme-raised"
          }`}>
            {item}
            {item === puzzle.answer && <span className="ml-2 text-xs font-black uppercase">Answer</span>}
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm font-semibold text-slate-700 dark:bg-[#292e38] dark:text-slate-200">{puzzle.explanation}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(([label, value]) => (
          <div key={label} className="theme-raised min-w-0 rounded-xl border p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 break-words text-sm font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button onClick={onRegenerate} className="rounded-xl bg-violet px-4 py-3 text-sm font-extrabold text-white">Regenerate puzzle</button>
        <button onClick={copyPuzzle} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-extrabold text-slate-700 dark:border-[#454c5a] dark:bg-[#292e38] dark:text-white">
          {copied ? "Puzzle JSON copied" : "Copy puzzle JSON"}
        </button>
      </div>

      <details className="mt-3 rounded-xl border">
        <summary className="cursor-pointer px-4 py-3 font-extrabold">Raw JSON</summary>
        <pre className="max-h-80 overflow-auto border-t p-4 text-[11px]">{JSON.stringify(preview, null, 2)}</pre>
      </details>
    </section>
  );
}
