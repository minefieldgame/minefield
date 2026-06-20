"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DailySummary from "@/components/DailySummary";
import BrandLogo from "@/components/BrandLogo";
import Header from "@/components/Header";
import MiniGameCard from "@/components/MiniGameCard";
import NeedleDropGame from "@/games/needledrop/NeedleDropGame";
import MinefieldGame from "@/games/minefield/MinefieldGame";
import SpellDropGame from "@/games/spelldrop/SpellDropGame";
import TopTenGame from "@/games/top-ten/TopTenGame";
import CloserGame from "@/games/closer/CloserGame";
import MeetMeHalfwayGame from "@/games/geography/MeetMeHalfwayGame";
import LandmarkDropGame from "@/games/geography/LandmarkDropGame";
import { formatChartDate, getDailyGameDate } from "@/lib/date";
import {
  calculateDailySummary,
  completeDailyBoard,
  loadGameProgress,
  saveGameProgress
} from "@/lib/minefieldStorage";
import type { MinefieldDailyBoard, MinefieldGameId, MinefieldGameResult } from "@/types/minefield";

const GAMES: Array<{ id: MinefieldGameId; title: string; subtitle: string }> = [
  { id: "needledrop", title: "NeedleDrop", subtitle: "Name the song from an increasingly longer clip." },
  { id: "minefield", title: "Minefield", subtitle: "Tap up to 5 tiles and avoid the 3 hidden mines." },
  { id: "top-ten", title: "Top 3", subtitle: "Name all three leaders in today’s ranked category." },
  { id: "spelldrop", title: "SpellDrop", subtitle: "Listen carefully and spell the word in one attempt." },
  { id: "closer", title: "Closer", subtitle: "Make one numeric guess and get as close as you can." },
  { id: "meet-me-halfway", title: "Meet Me Halfway", subtitle: "Drop a pin where you think the halfway point is." },
  { id: "landmark-drop", title: "Landmark Drop", subtitle: "Drop a pin where this landmark is located." }
];

export default function MinefieldFeed() {
  const date = getDailyGameDate();
  const [board, setBoard] = useState<MinefieldDailyBoard>({ date, results: {} });
  const [activeIndex, setActiveIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [completionResult, setCompletionResult] = useState<MinefieldGameResult | null>(null);

  useEffect(() => {
    const loaded = loadGameProgress(date);
    setBoard(loaded);
    setStarted(Boolean(localStorage.getItem(`minefield:started:${date}`)) || Object.keys(loaded.results).length > 0);
    const firstIncomplete = GAMES.findIndex((game) => !loaded.results[game.id]?.completed);
    setActiveIndex(firstIncomplete === -1 ? GAMES.length : firstIncomplete);
    setReady(true);
  }, [date]);

  const summary = useMemo(() => calculateDailySummary(board, GAMES.length), [board]);

  const handleComplete = useCallback((result: MinefieldGameResult) => {
    setCompletionResult(result);
    setBoard((current) => {
      const existing = current.results[result.gameId];
      if (
        existing?.completed &&
        existing.score === result.score &&
        existing.summaryLabel === result.summaryLabel
      ) return current;
      const next = saveGameProgress(current.date, result);
      if (Object.values(next.results).filter((entry) => entry?.completed).length === GAMES.length) {
        completeDailyBoard(next, GAMES.length);
      }
      return next;
    });
  }, []);

  const goNext = useCallback(() => {
    setCompletionResult(null);
    setActiveIndex((index) => Math.min(index + 1, GAMES.length));
  }, []);

  const activeGame = GAMES[activeIndex];
  const activeComplete = activeGame ? Boolean(board.results[activeGame.id]?.completed) : false;

  useEffect(() => {
    if (!activeComplete || completionResult?.gameId !== activeGame?.id) return;
    const timeout = window.setTimeout(goNext, 1100);
    return () => window.clearTimeout(timeout);
  }, [activeComplete, activeGame?.id, completionResult, goNext]);

  function startBoard() {
    localStorage.setItem(`minefield:started:${date}`, "true");
    setStarted(true);
  }

  return (
    <div className="h-dvh overflow-hidden">
      <Header />
      <div className="flex h-[calc(100dvh-68px)] flex-col">
        <div className="z-20 flex h-14 shrink-0 items-center gap-4 border-b border-slate-200/70 bg-white/75 px-4 backdrop-blur-xl dark:border-white/[.07] dark:bg-[#111318]/80">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-950 dark:text-white">{formatChartDate(date)}</p>
            <p className="text-[10px] font-black uppercase tracking-[.15em] text-[#db4e36] dark:text-[#ff826a]">Today’s Minefield</p>
          </div>
          <div className="ml-auto flex w-36 gap-1.5">
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

        <main className="relative flex-1 overflow-hidden">
          {!ready ? (
            <section className="grid h-full place-items-center px-4 text-sm font-bold text-slate-500">Preparing today’s games…</section>
          ) : !started ? (
            <section className="grid h-full place-items-center px-4">
              <div className="theme-surface w-full max-w-xl rounded-[2rem] border p-7 text-center sm:p-9">
                <div className="mx-auto flex h-28 items-center justify-center">
                  <BrandLogo priority className="h-28 w-auto object-contain drop-shadow-xl" />
                </div>
                <p className="mt-6 text-xs font-black uppercase tracking-[.22em] text-coral">Seven quick games · daily</p>
                <h1 className="mt-2 text-4xl font-black tracking-[-.05em] text-slate-950 dark:text-white">Minefield</h1>
                <p className="mx-auto mt-3 max-w-sm text-base font-semibold leading-7 text-slate-500 dark:text-slate-300">
                  A daily collection of quick trivia and skill games.
                </p>
                <button onClick={startBoard} className="mt-7 h-14 w-full rounded-2xl bg-violet px-6 font-extrabold text-white shadow-lg shadow-violet/25 active:scale-[.98] dark:bg-[#7569e5]">
                  Start Today&apos;s Board
                </button>
                <p className="mt-3 text-xs font-semibold text-slate-400">Progress saves automatically on this device.</p>
              </div>
            </section>
          ) : (
            <>
              {GAMES.map((game, index) => {
                const active = index === activeIndex;
                const result = board.results[game.id];
                const nextTitle = GAMES[index + 1]?.title ?? "Daily Summary";
                return (
                  <section
                    key={game.id}
                    aria-hidden={!active}
                    inert={!active}
                    className={`absolute inset-0 flex items-center justify-center overflow-hidden px-3 py-3 transition-transform duration-500 ease-[cubic-bezier(.22,.8,.3,1)] ${
                      active ? "pointer-events-auto" : "pointer-events-none"
                    }`}
                    style={{ transform: `translateY(${(index - activeIndex) * 100}%)` }}
                  >
                    <div className="relative w-full max-w-xl">
                      <MiniGameCard number={index + 1} title={game.title} subtitle={game.subtitle}>
                        {active && (
                          game.id === "needledrop" ? (
                            <NeedleDropGame onComplete={handleComplete} />
                          ) : game.id === "minefield" ? (
                            <MinefieldGame onComplete={handleComplete} />
                          ) : game.id === "top-ten" ? (
                            <TopTenGame onComplete={handleComplete} />
                          ) : game.id === "spelldrop" ? (
                            <SpellDropGame onComplete={handleComplete} />
                          ) : game.id === "closer" ? (
                            <CloserGame onComplete={handleComplete} />
                          ) : game.id === "meet-me-halfway" ? (
                            <MeetMeHalfwayGame onComplete={handleComplete} />
                          ) : (
                            <LandmarkDropGame onComplete={handleComplete} />
                          )
                        )}
                      </MiniGameCard>

                      {active && activeComplete && result && (
                        <div className="absolute inset-0 z-30 grid place-items-center rounded-[1.5rem] bg-white/88 p-5 text-center backdrop-blur-md dark:bg-[#171a21]/90">
                          <div>
                            <p className="text-3xl" aria-hidden="true">{result.icon}</p>
                            <h3 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{game.title} complete</h3>
                            <p className="mt-1 text-lg font-black text-violet dark:text-[#9187f6]">Score: {result.score}/{result.maxScore}</p>
                            <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-300">Next up: {nextTitle}</p>
                            <button onClick={goNext} className="mt-4 rounded-xl bg-violet px-6 py-3 font-extrabold text-white dark:bg-[#7569e5]">
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}

              <section
                aria-hidden={activeIndex !== GAMES.length}
                inert={activeIndex !== GAMES.length}
                className={`absolute inset-0 flex items-center justify-center overflow-y-auto px-3 py-3 transition-transform duration-500 ease-[cubic-bezier(.22,.8,.3,1)] ${
                  activeIndex === GAMES.length ? "pointer-events-auto touch-pan-y" : "pointer-events-none"
                }`}
                style={{ transform: `translateY(${(GAMES.length - activeIndex) * 100}%)` }}
              >
                <div className="w-full max-w-xl"><DailySummary summary={summary} /></div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
