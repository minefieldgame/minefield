"use client";

import { useState } from "react";
import { formatChartDate } from "@/lib/date";
import { loadMinefieldStats } from "@/lib/minefieldStorage";
import { copyResultText, shareResult } from "@/lib/shareResult";
import type { MinefieldSummary } from "@/types/minefield";
import { GAME_DISPLAY, PRELIMINARY_GAME_IDS } from "@/lib/gameDisplay";

export function getPrepResults(summary: MinefieldSummary) {
  const isLegacyBoard = !summary.results.some((result) => result.gameId === "odd-one-out") &&
    summary.results.some((result) => result.gameId === "sing-along");
  return summary.results.filter((result) =>
    PRELIMINARY_GAME_IDS.some((gameId) => gameId === result.gameId) ||
    (isLegacyBoard && result.gameId === "sing-along")
  );
}

export function getFinalMinefield(summary: MinefieldSummary) {
  return summary.results.find((result) => result.gameId === "minefield");
}

export function buildMinefieldShare(summary: MinefieldSummary) {
  const prepResults = getPrepResults(summary);
  const prepScore = prepResults.reduce((total, result) => total + result.score, 0);
  const prepMaxScore = prepResults.reduce((total, result) => total + result.maxScore, 0);
  const final = getFinalMinefield(summary);
  const review = final?.reviewData.type === "minefield" ? final.reviewData : null;
  const survived = Boolean(review && !review.hitMine);
  return [
    "Minefield Daily",
    formatChartDate(summary.date),
    "",
    `Prep Score: ${prepScore} / ${prepMaxScore}`,
    "",
    ...prepResults.map((result) => result.gameId === "vaultbreak"
      ? result.shareLine
      : `${GAME_DISPLAY[result.gameId].icon} ${GAME_DISPLAY[result.gameId].name}: ${result.score}`),
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
  const [shareStatus, setShareStatus] = useState<"idle" | "shared" | "copied" | "failed">("idle");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const prepResults = getPrepResults(summary);
  const prepScore = prepResults.reduce((total, result) => total + result.score, 0);
  const prepMaxScore = prepResults.reduce((total, result) => total + result.maxScore, 0);
  const final = getFinalMinefield(summary);
  const minefield = final?.reviewData.type === "minefield" ? final.reviewData : null;

  async function handleShare() {
    const status = await shareResult(buildMinefieldShare(summary));
    if (status === "cancelled") return;
    setShareStatus(status);
    window.setTimeout(() => setShareStatus("idle"), 1800);
  }

  async function handleCopy() {
    const status = await copyResultText(buildMinefieldShare(summary));
    setCopyStatus(status);
    window.setTimeout(() => setCopyStatus("idle"), 1800);
  }

  return (
    <section className="theme-surface min-w-0 w-full overflow-hidden rounded-[1.5rem] border p-4 sm:p-6">
      <div className="text-center">
        <p className="text-xs font-black uppercase tracking-[.2em] text-coral">Daily Board Complete</p>
        <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-300">{formatChartDate(summary.date)}</p>
      </div>

      <section className="theme-raised mt-5 rounded-2xl border p-4">
        <p className="text-xs font-black uppercase tracking-wider text-slate-500">Daily Prep Score</p>
        <p className="mt-1 text-3xl font-black text-slate-950 dark:text-white">
          {prepScore}<span className="text-lg text-slate-400">/{prepMaxScore}</span>
        </p>
        <div className="mt-3 space-y-1.5">
          {prepResults.map((result) => (
            <div key={result.gameId} className="flex min-w-0 items-start justify-between gap-3 text-sm">
              <span className="min-w-0 break-words font-bold text-slate-700 dark:text-slate-200">{GAME_DISPLAY[result.gameId].icon} {GAME_DISPLAY[result.gameId].name}</span>
              <span className="shrink-0 font-black text-violet">{result.score}</span>
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
        <button onClick={handleShare} className="min-h-12 w-full rounded-xl bg-violet px-4 py-3 text-sm font-extrabold leading-tight text-white shadow-lg shadow-violet/25 active:scale-[.98]">
          {shareStatus === "shared"
            ? "Shared!"
            : shareStatus === "copied"
              ? "Copied result"
              : shareStatus === "failed"
                ? "Share unavailable"
                : "Share Result"}
        </button>
        <button onClick={handleCopy} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-extrabold leading-tight text-slate-800 shadow-sm active:scale-[.98] dark:border-[#454c5a] dark:bg-[#292e38] dark:text-white">
          {copyStatus === "copied" ? "Copied results." : copyStatus === "failed" ? "Copy unavailable" : "Copy Results as Text"}
        </button>
      </div>
      <p className="mt-3 text-center text-sm font-semibold text-slate-500 dark:text-slate-300">
        🔥 {stats.currentStreak} day streak · New board at midnight Pacific.
      </p>
    </section>
  );
}
