"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DailyAnswerReview from "@/components/DailyAnswerReview";
import Header from "@/components/Header";
import {
  buildMinefieldShare,
  getFinalMinefield,
  getPrepResults
} from "@/components/DailySummary";
import { formatChartDate, getPacificDateKey } from "@/lib/date";
import { calculateDailySummary, loadGameProgress, loadMinefieldStats } from "@/lib/minefieldStorage";
import { copyResultText, shareResult } from "@/lib/shareResult";
import type { MinefieldSummary } from "@/types/minefield";
import { ACTIVE_GAME_IDS, GAME_DISPLAY } from "@/lib/gameDisplay";

export default function ReviewPageClient({
  requestedDate,
  mode = "daily",
  accessDenied = false
}: {
  requestedDate?: string;
  mode?: "daily" | "admin-preview";
  accessDenied?: boolean;
}) {
  const [summary, setSummary] = useState<MinefieldSummary | null>(null);
  const [ready, setReady] = useState(false);
  const [shareStatus, setShareStatus] = useState<"idle" | "shared" | "copied" | "failed">("idle");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : getPacificDateKey();

  useEffect(() => {
    setSummary(calculateDailySummary(
      loadGameProgress(date, mode === "admin-preview" ? "admin-preview" : undefined),
      ACTIVE_GAME_IDS.length
    ));
    setReady(true);
  }, [date, mode]);

  async function share() {
    if (!summary) return;
    const status = await shareResult(buildMinefieldShare(summary));
    if (status === "cancelled") return;
    setShareStatus(status);
    window.setTimeout(() => setShareStatus("idle"), 1800);
  }

  async function copy() {
    if (!summary) return;
    const status = await copyResultText(buildMinefieldShare(summary));
    setCopyStatus(status);
    window.setTimeout(() => setCopyStatus("idle"), 1800);
  }

  if (accessDenied) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-xl px-4 py-10 text-center">
          <section className="theme-surface rounded-[2rem] border p-7">
            <h1 className="text-2xl font-black text-slate-950 dark:text-white">Admin access required</h1>
            <Link href="/admin" className="mt-5 inline-flex rounded-xl bg-violet px-6 py-3 font-extrabold text-white">Open Admin</Link>
          </section>
        </main>
      </>
    );
  }

  if (!ready) {
    return (
      <>
        <Header />
        <main className="grid min-h-[calc(100dvh-68px)] place-items-center px-4 text-sm font-bold text-slate-500">Loading daily review…</main>
      </>
    );
  }

  if (!summary || summary.gamesCompleted < summary.totalGames) {
    return (
      <>
        <Header />
        <main className="mx-auto min-h-[calc(100dvh-68px)] max-w-xl px-4 py-10">
          <section className="theme-surface rounded-[2rem] border p-7 text-center">
            <h1 className="text-2xl font-black text-slate-950 dark:text-white">Finish the board first</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">Daily answers unlock after all nine games are complete.</p>
            <Link href="/" className="mt-5 inline-flex rounded-xl bg-violet px-6 py-3 font-extrabold text-white">Return to today’s board</Link>
          </section>
        </main>
      </>
    );
  }

  const stats = mode === "admin-preview" ? { currentStreak: 0, maxStreak: 0 } : loadMinefieldStats();
  const prepResults = getPrepResults(summary);
  const prepScore = prepResults.reduce((total, result) => total + result.score, 0);
  const prepMaxScore = prepResults.reduce((total, result) => total + result.maxScore, 0);
  const final = getFinalMinefield(summary);
  const minefield = final?.reviewData.type === "minefield" ? final.reviewData : null;

  return (
    <>
      <Header />
      <main className="mx-auto min-h-[calc(100dvh-68px)] w-full min-w-0 max-w-2xl overflow-x-hidden px-3 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-5 sm:px-4 sm:pt-6">
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.2em] text-coral">
            {mode === "admin-preview" ? "Admin preview complete" : "Board complete"}
          </p>
          <h1 className="mt-1 break-words text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">Daily Results</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">{formatChartDate(summary.date)}</p>
        </div>

        <section className="theme-surface rounded-2xl border p-5">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Daily Prep Score</p>
          <p className="mt-1 text-3xl font-black text-slate-950 dark:text-white sm:text-4xl">
            {prepScore}<span className="text-xl text-slate-400">/{prepMaxScore}</span>
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {prepResults.map((result) => (
              <div key={result.gameId} className="theme-raised flex min-w-0 items-start justify-between gap-2 rounded-xl border px-3 py-2.5">
                <span className="min-w-0 break-words text-sm font-extrabold text-slate-800 dark:text-slate-100">{GAME_DISPLAY[result.gameId].icon} {GAME_DISPLAY[result.gameId].name}</span>
                <span className="shrink-0 font-black text-violet">{result.score}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={`mt-4 rounded-2xl border p-5 ${
          minefield && !minefield.hitMine
            ? "border-emerald-300 bg-emerald-500/10"
            : "border-red-300 bg-red-500/10"
        }`}>
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Final Minefield</p>
          <h2 className="mt-1 break-words text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">
            {minefield ? (minefield.hitMine ? "Did not survive" : "Survived") : "Unavailable"}
          </h2>
          {minefield && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ReviewStat label="Difficulty" value={minefield.difficulty} />
              <ReviewStat label="Mines" value={String(minefield.mineCount)} />
              <ReviewStat label="Required picks" value={String(minefield.maxPicks)} />
              <ReviewStat label="Safe picks" value={String(minefield.safePicks.length)} />
            </div>
          )}
          {final && <p className="mt-3 text-sm font-bold text-slate-600 dark:text-slate-300">{final.summaryLabel}</p>}
        </section>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button onClick={share} className="min-h-12 w-full rounded-xl bg-violet px-4 py-3 text-sm font-extrabold leading-tight text-white shadow-lg shadow-violet/20 active:scale-[.98]">
            {shareStatus === "shared"
              ? "Shared!"
              : shareStatus === "copied"
                ? "Copied result"
                : shareStatus === "failed"
                  ? "Share unavailable"
                  : "Share Result"}
          </button>
          <button onClick={copy} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-extrabold leading-tight text-slate-800 shadow-sm active:scale-[.98] dark:border-[#454c5a] dark:bg-[#292e38] dark:text-white">
            {copyStatus === "copied" ? "Copied results." : copyStatus === "failed" ? "Copy unavailable" : "Copy Results as Text"}
          </button>
        </div>

        <h2 id="daily-answers" className="mb-3 mt-7 scroll-mt-24 text-lg font-black text-slate-950 dark:text-white">Individual game answers</h2>
        <DailyAnswerReview summary={summary} />

        <section className="theme-surface mt-7 rounded-2xl border p-5">
          <h2 className="text-lg font-black text-slate-950 dark:text-white">Statistics</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <ReviewStat label="Current streak" value={`${stats.currentStreak} days`} />
            <ReviewStat label="Best streak" value={`${stats.maxStreak} days`} />
          </div>
        </section>

        <p className="mt-4 text-center text-sm font-semibold text-slate-500 dark:text-slate-300">
          {mode === "admin-preview" ? "This preview did not affect daily progress." : "New daily board available at midnight Pacific."}
        </p>
      </main>
    </>
  );
}

function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="theme-raised min-w-0 rounded-xl border p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 break-words text-base font-black text-slate-950 dark:text-white sm:text-lg">{value}</p>
    </div>
  );
}
