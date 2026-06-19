"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DailySummary from "@/components/DailySummary";
import Header from "@/components/Header";
import MiniGameCard from "@/components/MiniGameCard";
import NeedleDropGame from "@/games/needledrop/NeedleDropGame";
import TopTenGame from "@/games/top-ten/TopTenGame";
import { getDailyGameDate, formatChartDate } from "@/lib/date";
import {
  calculateDailySummary,
  completeDailyBoard,
  loadGameProgress,
  saveGameProgress
} from "@/lib/minefieldStorage";
import type { MinefieldDailyBoard, MinefieldGameId, MinefieldGameResult } from "@/types/minefield";

const GAMES: Array<{
  id: MinefieldGameId;
  title: string;
  subtitle: string;
}> = [
  { id: "needledrop", title: "NeedleDrop", subtitle: "Name the song from a tiny clip" },
  { id: "top-ten", title: "Top 10", subtitle: "Find every answer on today’s list" }
];

export default function MinefieldFeed() {
  const date = getDailyGameDate();
  const [board, setBoard] = useState<MinefieldDailyBoard>({ date, results: {} });
  const [activeIndex, setActiveIndex] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loaded = loadGameProgress(date);
    setBoard(loaded);
    const firstIncomplete = GAMES.findIndex((game) => !loaded.results[game.id]?.completed);
    setActiveIndex(firstIncomplete === -1 ? GAMES.length : firstIncomplete);
    setReady(true);
  }, [date]);

  const summary = useMemo(() => calculateDailySummary(board, GAMES.length), [board]);

  const handleComplete = useCallback((result: MinefieldGameResult) => {
    setBoard((current) => {
      const existing = current.results[result.gameId];
      if (
        existing?.completed &&
        existing.score === result.score &&
        existing.detail === result.detail
      ) return current;
      const next = saveGameProgress(current.date, result);
      if (Object.values(next.results).filter((entry) => entry?.completed).length === GAMES.length) {
        completeDailyBoard(next, GAMES.length);
      }
      return next;
    });
  }, []);

  function nextGame() {
    setActiveIndex((index) => Math.min(index + 1, GAMES.length));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const activeGame = GAMES[activeIndex];
  const activeComplete = activeGame ? Boolean(board.results[activeGame.id]?.completed) : false;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-xl px-4 pb-14">
        <div className="pb-5 pt-7">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-[#db4e36] dark:text-[#ff826a]">Today’s Minefield</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-.04em] text-slate-950 dark:text-white">
                {formatChartDate(date)}
              </h1>
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
            <span className="text-xs font-bold text-slate-500 dark:text-slate-300">
              {summary.gamesCompleted}/{GAMES.length}
            </span>
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
              ) : (
                <TopTenGame onComplete={handleComplete} />
              )}
            </MiniGameCard>

            {activeComplete && (
              <button
                onClick={nextGame}
                className="mt-4 w-full rounded-2xl bg-[#202128] px-5 py-4 font-extrabold text-white shadow-lg hover:bg-[#30323a] active:scale-[.98] dark:bg-white dark:text-[#171920] dark:hover:bg-slate-100"
              >
                {activeIndex === GAMES.length - 1 ? "See daily summary" : "Next game ↑"}
              </button>
            )}
          </div>
        )}
      </main>
    </>
  );
}
