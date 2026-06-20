"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DailySummary from "@/components/DailySummary";
import Header from "@/components/Header";
import MiniGameCard from "@/components/MiniGameCard";
import NeedleDropGame from "@/games/needledrop/NeedleDropGame";
import SpellDropGame from "@/games/spelldrop/SpellDropGame";
import TopTenGame from "@/games/top-ten/TopTenGame";
import { formatChartDate, getDailyGameDate } from "@/lib/date";
import {
  calculateDailySummary,
  completeDailyBoard,
  loadGameProgress,
  saveGameProgress
} from "@/lib/minefieldStorage";
import type { MinefieldDailyBoard, MinefieldGameId, MinefieldGameResult } from "@/types/minefield";

const GAMES: Array<{ id: MinefieldGameId; title: string; subtitle: string }> = [
  { id: "needledrop", title: "NeedleDrop", subtitle: "Name the song from a tiny clip" },
  { id: "top-ten", title: "Top 10", subtitle: "Find every answer on today’s list" },
  { id: "spelldrop", title: "SpellDrop", subtitle: "One word. One chance." }
];

export default function MinefieldFeed() {
  const date = getDailyGameDate();
  const [board, setBoard] = useState<MinefieldDailyBoard>({ date, results: {} });
  const [activeIndex, setActiveIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [completionResult, setCompletionResult] = useState<MinefieldGameResult | null>(null);

  useEffect(() => {
    const loaded = loadGameProgress(date);
    setBoard(loaded);
    const firstIncomplete = GAMES.findIndex((game) => !loaded.results[game.id]?.completed);
    setActiveIndex(firstIncomplete === -1 ? GAMES.length : firstIncomplete);
    setReady(true);
  }, [date]);

  const summary = useMemo(() => calculateDailySummary(board, GAMES.length), [board]);

  const handleComplete = useCallback((result: MinefieldGameResult) => {
    setCompletionResult(result);
    setBoard((current) => {
      const existing = current.results[result.gameId];
      if (existing?.completed && existing.score === result.score && existing.detail === result.detail) {
        return current;
      }
      const next = saveGameProgress(current.date, result);
      if (Object.values(next.results).filter((entry) => entry?.completed).length === GAMES.length) {
        completeDailyBoard(next, GAMES.length);
      }
      return next;
    });
  }, []);

  const nextGame = useCallback(() => {
    setCompletionResult(null);
    setActiveIndex((index) => Math.min(index + 1, GAMES.length));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const activeGame = GAMES[activeIndex];
  const activeComplete = activeGame ? Boolean(board.results[activeGame.id]?.completed) : false;

  useEffect(() => {
    if (!activeComplete || completionResult?.gameId !== activeGame?.id) return;
    const timeout = window.setTimeout(nextGame, 1700);
    return () => window.clearTimeout(timeout);
  }, [activeComplete, activeGame?.id, completionResult, nextGame]);

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-xl px-4 pb-14">
        <div className="pb-5 pt-7">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-[#db4e36] dark:text-[#ff826a]">Today’s Minefield</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-.04em] text-slate-950 dark:text-white">{formatChartDate(date)}</h1>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-violet dark:text-[#9187f6]">{summary.totalScore}</p>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">daily points</p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <div className="flex flex-1 gap-2">
              {GAMES.map((game, index) => (
                <span
                  key={game.id}
                  className={`h-2 flex-1 rounded-full ${
                    board.results[game.id]?.completed
                      ? "bg-emerald-500 dark:bg-emerald-400"
                      : index === activeIndex
                        ? "bg-violet dark:bg-[#7569e5]"
                        : "bg-slate-200 dark:bg-[#343a47]"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-300">{summary.gamesCompleted}/{GAMES.length}</span>
          </div>
        </div>

        {!ready ? (
          <div className="theme-surface rounded-[2rem] border p-12 text-center text-sm font-semibold text-slate-500 dark:text-slate-300">
            Preparing your daily board…
          </div>
        ) : activeIndex === GAMES.length ? (
          <DailySummary summary={summary} />
        ) : (
          <div key={activeGame.id} className="animate-[fadeIn_.25s_ease-out]">
            <MiniGameCard number={activeIndex + 1} title={activeGame.title} subtitle={activeGame.subtitle}>
              {activeGame.id === "needledrop" ? (
                <NeedleDropGame onComplete={handleComplete} />
              ) : activeGame.id === "top-ten" ? (
                <TopTenGame onComplete={handleComplete} />
              ) : (
                <SpellDropGame onComplete={handleComplete} />
              )}
            </MiniGameCard>

            {activeComplete && (
              <div className="mt-4 animate-[fadeIn_.2s_ease-out] rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/10">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-emerald-900 dark:text-emerald-100">
                      Game complete · {board.results[activeGame.id]?.score ?? 0} points
                    </p>
                    <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                      {activeIndex === GAMES.length - 1 ? "Opening your daily summary…" : "Moving to the next game…"}
                    </p>
                  </div>
                  <button
                    onClick={nextGame}
                    className="shrink-0 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-extrabold text-white active:scale-[.97] dark:bg-emerald-400 dark:text-emerald-950"
                  >
                    {activeIndex === GAMES.length - 1 ? "Summary" : "Next Game"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
