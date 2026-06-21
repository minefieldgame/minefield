"use client";

import Link from "next/link";
import { useState } from "react";
import { formatChartDate } from "@/lib/date";
import { loadMinefieldStats } from "@/lib/minefieldStorage";
import type { MinefieldGameResult, MinefieldSummary } from "@/types/minefield";

const PREP_IDS: MinefieldGameResult["gameId"][] = [
  "needledrop",
  "ranked-top-10",
  "spelldrop",
  "closer",
  "meet-me-halfway",
  "landmark-drop"
];

export function getPrepResults(summary: MinefieldSummary) {
  return summary.results.filter((result) => PREP_IDS.includes(result.gameId));
}

export function getFinalMinefield(summary: MinefieldSummary) {
  return summary.results.find((result) => result.gameId === "minefield");
}

export function buildMinefieldShare(summary: MinefieldSummary) {
  const prepResults = getPrepResults(summary);
  const prepScore = prepResults.reduce((total, result) => total + result.score, 0);
  const final = getFinalMinefield(summary);
  const review = final?.reviewData.type === "minefield" ? final.reviewData : null;
  const survived = Boolean(review && !review.hitMine);
  return [
    "Minefield Daily",
    formatChartDate(summary.date),
    "",
    `Prep Score: ${prepScore} / 600`,
    "",
    ...prepResults.map((result) => `${result.icon} ${result.displayName}: ${result.score}`),
    "",
    `Final Minefield: ${survived ? "Survived" : "Did not survive"}`,
    `Difficulty: ${review?.difficulty ?? "Unavailable"}`,
    review
      ? survived
        ? `Mines: ${"💣".repeat(review.mineCount)} / ${review.mineCount} mines`
        : `Hit a mine after ${review.safePicks.length} safe ${review.safePicks.length === 1 ? "pick" : "picks"}.`
      : "Final challenge unavailable.",
    "",
    "Play:",
    "https://minefieldgame.com"
  ].join("\n");
}

export default function DailySummary({ summary }: { summary: MinefieldSummary }) {
  const stats = loadMinefieldStats();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const prepResults = getPrepResults(summary);
  const prepScore = prepResults.reduce((total, result) => total + result.score, 0);
  const final = getFinalMinefield(summary);
  const minefield = final?.reviewData.type === "minefield" ? final.reviewData : null;

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(buildMinefieldShare(summary));
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
    window.setTimeout(() => setCopyStatus("idle"), 1600);
  }

  return (
    <section className="theme-surface w-full rounded-[1.5rem] border p-5 sm:p-6">
      <div className="text-center">
        <p className="text-xs font-black uppercase tracking-[.2em] text-coral">Daily Board Complete</p>
        <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-300">{formatChartDate(summary.date)}</p>
      </div>

      <section className="theme-raised mt-5 rounded-2xl border p-4">
        <p className="text-xs font-black uppercase tracking-wider text-slate-500">Daily Prep Score</p>
        <p className="mt-1 text-3xl font-black text-slate-950 dark:text-white">
          {prepScore}<span className="text-lg text-slate-400">/600</span>
        </p>
        <div className="mt-3 space-y-1.5">
          {prepResults.map((result) => (
            <div key={result.gameId} className="flex items-center justify-between text-sm">
              <span className="font-bold text-slate-700 dark:text-slate-200">{result.icon} {result.displayName}</span>
              <span className="font-black text-violet">{result.score}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={`mt-3 rounded-2xl border p-4 ${
        minefield && !minefield.hitMine
          ? "border-emerald-300 bg-emerald-500/10"
          : "border-red-300 bg-red-500/10"
      }`}>
        <p className="text-xs font-black uppercase tracking-wider text-slate-500">Final Minefield</p>
        <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
          {minefield ? (minefield.hitMine ? "Did not survive" : "Survived") : "Unavailable"}
        </p>
        {minefield && (
          <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
            {minefield.difficulty} · {minefield.mineCount} mines · {minefield.safePicks.length}/{minefield.maxPicks} safe picks
          </p>
        )}
        {final && <p className="mt-1 text-xs font-bold text-slate-500">{final.summaryLabel}</p>}
      </section>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button onClick={copyResult} className="h-12 rounded-xl bg-violet px-5 font-extrabold text-white shadow-lg shadow-violet/25 active:scale-[.98]">
          {copyStatus === "copied" ? "Copied!" : copyStatus === "failed" ? "Copy unavailable" : "Copy Result"}
        </button>
        <Link href={`/review?date=${summary.date}`} className="flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 font-extrabold text-slate-800 dark:border-[#454c5a] dark:bg-[#292e38] dark:text-white">
          Review Answers
        </Link>
      </div>
      <p className="mt-3 text-center text-sm font-semibold text-slate-500 dark:text-slate-300">
        🔥 {stats.currentStreak} day streak · New board at midnight Pacific.
      </p>
    </section>
  );
}
