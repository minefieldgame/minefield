"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  { id: "needledrop", title: "NeedleDrop", subtitle: "Name the song" },
  { id: "top-ten", title: "Top 3", subtitle: "Find three answers" },
  { id: "spelldrop", title: "SpellDrop", subtitle: "One word. One chance." }
];

export default function MinefieldFeed() {
  const date = getDailyGameDate();
  const [board, setBoard] = useState<MinefieldDailyBoard>({ date, results: {} });
  const [activeIndex, setActiveIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [completionResult, setCompletionResult] = useState<MinefieldGameResult | null>(null);
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const loaded = loadGameProgress(date);
    setBoard(loaded);
    const firstIncomplete = GAMES.findIndex((game) => !loaded.results[game.id]?.completed);
    const initial = firstIncomplete === -1 ? GAMES.length : firstIncomplete;
    setActiveIndex(initial);
    setReady(true);
    requestAnimationFrame(() => sectionRefs.current[initial]?.scrollIntoView({ block: "start" }));
  }, [date]);

  const summary = useMemo(() => calculateDailySummary(board, GAMES.length), [board]);

  const handleComplete = useCallback((result: MinefieldGameResult) => {
    setCompletionResult(result);
    setBoard((current) => {
      const existing = current.results[result.gameId];
      if (existing?.completed && existing.score === result.score && existing.detail === result.detail) return current;
      const next = saveGameProgress(current.date, result);
      if (Object.values(next.results).filter((entry) => entry?.completed).length === GAMES.length) {
        completeDailyBoard(next, GAMES.length);
      }
      return next;
    });
  }, []);

  const goTo = useCallback((index: number) => {
    const next = Math.max(0, Math.min(index, GAMES.length));
    setCompletionResult(null);
    setActiveIndex(next);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        sectionRefs.current[next]?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }, []);

  const activeGame = GAMES[activeIndex];
  const activeComplete = activeGame ? Boolean(board.results[activeGame.id]?.completed) : false;

  useEffect(() => {
    if (!activeComplete || completionResult?.gameId !== activeGame?.id) return;
    const timeout = window.setTimeout(() => goTo(activeIndex + 1), 1100);
    return () => window.clearTimeout(timeout);
  }, [activeComplete, activeGame?.id, activeIndex, completionResult, goTo]);

  return (
    <div className="h-dvh overflow-hidden">
      <Header />
      <div className="flex h-[calc(100dvh-68px)] flex-col">
        <div className="z-20 flex h-14 shrink-0 items-center gap-4 border-b border-slate-200/70 bg-white/75 px-4 backdrop-blur-xl dark:border-white/[.07] dark:bg-[#111318]/80">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-950 dark:text-white">{formatChartDate(date)}</p>
            <p className="text-[10px] font-black uppercase tracking-[.15em] text-[#db4e36] dark:text-[#ff826a]">Today’s Minefield</p>
          </div>
          <div className="ml-auto flex w-32 gap-1.5">
            {GAMES.map((game, index) => (
              <span
                key={game.id}
                className={`h-1.5 flex-1 rounded-full ${
                  board.results[game.id]?.completed
                    ? "bg-emerald-500 dark:bg-emerald-400"
                    : index === activeIndex
                      ? "bg-violet dark:bg-[#7569e5]"
                      : "bg-slate-200 dark:bg-[#343a47]"
                }`}
              />
            ))}
          </div>
          <span className="text-sm font-black text-violet dark:text-[#9187f6]">{summary.totalScore}</span>
        </div>

        <main className="minefield-snap-feed flex-1 snap-y snap-mandatory overflow-y-auto overscroll-y-contain scroll-smooth">
          {!ready ? (
            <section className="grid h-full snap-start place-items-center px-4 text-sm font-bold text-slate-500">Preparing today’s games…</section>
          ) : (
            <>
              {GAMES.map((game, index) => {
                const result = board.results[game.id];
                const active = index === activeIndex;
                return (
                  <section
                    key={game.id}
                    ref={(node) => { sectionRefs.current[index] = node; }}
                    className="flex min-h-full snap-start snap-always items-center justify-center overflow-hidden px-3 py-3"
                    aria-current={active ? "step" : undefined}
                  >
                    <div className="w-full max-w-xl">
                      {active ? (
                        <>
                          <MiniGameCard number={index + 1} title={game.title} subtitle={game.subtitle}>
                            {game.id === "needledrop" ? (
                              <NeedleDropGame onComplete={handleComplete} />
                            ) : game.id === "top-ten" ? (
                              <TopTenGame onComplete={handleComplete} />
                            ) : (
                              <SpellDropGame onComplete={handleComplete} />
                            )}
                          </MiniGameCard>
                          {activeComplete && (
                            <div className="mt-2 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 dark:border-emerald-400/20 dark:bg-emerald-400/10">
                              <div>
                                <p className="text-sm font-black text-emerald-900 dark:text-emerald-100">Complete · {result?.score ?? 0} points</p>
                                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Sliding to the next game…</p>
                              </div>
                              <button onClick={() => goTo(index + 1)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-extrabold text-white dark:bg-emerald-400 dark:text-emerald-950">
                                Next Game
                              </button>
                            </div>
                          )}
                        </>
                      ) : index < activeIndex && result ? (
                        <button onClick={() => goTo(index)} className="theme-surface w-full rounded-2xl border p-5 text-left">
                          <p className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-300">Completed</p>
                          <div className="mt-1 flex items-center justify-between">
                            <h2 className="text-2xl font-black text-slate-950 dark:text-white">{game.title}</h2>
                            <span className="text-2xl font-black text-violet dark:text-[#9187f6]">{result.score}</span>
                          </div>
                        </button>
                      ) : (
                        <div className="text-center text-sm font-bold text-slate-400 dark:text-slate-600">{game.title}</div>
                      )}
                    </div>
                  </section>
                );
              })}
              <section
                ref={(node) => { sectionRefs.current[GAMES.length] = node; }}
                className="flex min-h-full snap-start snap-always items-center justify-center overflow-y-auto px-3 py-3"
              >
                <div className="w-full max-w-xl">
                  {activeIndex === GAMES.length ? (
                    <DailySummary summary={summary} />
                  ) : (
                    <div className="text-center text-sm font-bold text-slate-400 dark:text-slate-600">Complete all three games to unlock today’s summary.</div>
                  )}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
