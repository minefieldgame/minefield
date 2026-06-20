"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DailyAnswerReview from "@/components/DailyAnswerReview";
import Header from "@/components/Header";
import { buildMinefieldShare } from "@/components/DailySummary";
import { formatChartDate, getDailyGameDate } from "@/lib/date";
import { calculateDailySummary, loadGameProgress, loadMinefieldStats } from "@/lib/minefieldStorage";
import type { MinefieldSummary } from "@/types/minefield";

export default function ReviewPageClient({ requestedDate }: { requestedDate?: string }) {
  const [summary, setSummary] = useState<MinefieldSummary | null>(null);
  const [ready, setReady] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : getDailyGameDate();

  useEffect(() => {
    setSummary(calculateDailySummary(loadGameProgress(date), 7));
    setReady(true);
  }, [date]);

  async function share() {
    if (!summary) return;
    const text = buildMinefieldShare(summary);
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("copied");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      setCopyStatus(copied ? "copied" : "failed");
    }
    window.setTimeout(() => setCopyStatus("idle"), 1800);
  }

  if (!ready) {
    return (
      <>
        <Header />
        <main className="grid min-h-[calc(100dvh-68px)] place-items-center px-4 text-sm font-bold text-slate-500">
          Loading daily review…
        </main>
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
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">
              Daily answers unlock after all seven games are complete.
            </p>
            <Link href="/" className="mt-5 inline-flex rounded-xl bg-violet px-6 py-3 font-extrabold text-white">
              Return to today’s board
            </Link>
          </section>
        </main>
      </>
    );
  }

  const stats = loadMinefieldStats();
  return (
    <>
      <Header />
      <main className="mx-auto min-h-[calc(100dvh-68px)] w-full max-w-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-6">
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.2em] text-coral">Board complete</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Daily Results</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">{formatChartDate(summary.date)}</p>
        </div>

        <section className="theme-surface rounded-2xl border p-5">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Total score</p>
              <p className="mt-1 text-4xl font-black text-slate-950 dark:text-white">
                {summary.totalScore}<span className="text-xl text-slate-400">/{summary.maxScore}</span>
              </p>
            </div>
            <p className="text-sm font-black text-violet">{summary.results.length} games</p>
          </div>
        </section>

        <h2 className="mb-3 mt-7 text-lg font-black text-slate-950 dark:text-white">Individual game answers</h2>
        <DailyAnswerReview summary={summary} />

        <section className="theme-surface mt-7 rounded-2xl border p-5">
          <h2 className="text-lg font-black text-slate-950 dark:text-white">Statistics</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <ReviewStat label="Current streak" value={`${stats.currentStreak} days`} />
            <ReviewStat label="Best streak" value={`${stats.maxStreak} days`} />
          </div>
        </section>

        <section className="theme-surface mt-7 rounded-2xl border p-5">
          <h2 className="text-lg font-black text-slate-950 dark:text-white">Share your board</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Copy a spoiler-free scorecard for today’s games.
          </p>
          <button onClick={share} className="mt-4 h-12 w-full rounded-xl bg-violet font-extrabold text-white shadow-lg shadow-violet/20 active:scale-[.98]">
            {copyStatus === "copied" ? "Copied!" : copyStatus === "failed" ? "Copy unavailable" : "Copy Result"}
          </button>
        </section>

        <Link href="/" className="mt-4 flex h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-white font-extrabold text-slate-800 dark:border-[#454c5a] dark:bg-[#292e38] dark:text-white">
          Return Home
        </Link>
        <p className="mt-4 text-center text-sm font-semibold text-slate-500 dark:text-slate-300">
          New daily board available at midnight Pacific.
        </p>
      </main>
    </>
  );
}

function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="theme-raised rounded-xl border p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}
