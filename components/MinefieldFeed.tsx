"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import DailySummary from "@/components/DailySummary";
import Header from "@/components/Header";
import MiniGameCard from "@/components/MiniGameCard";
import CloserGame from "@/games/closer/CloserGame";
import LandmarkDropGame from "@/games/geography/LandmarkDropGame";
import MeetMeHalfwayGame from "@/games/geography/MeetMeHalfwayGame";
import MinefieldGame from "@/games/minefield/MinefieldGame";
import NeedleDropGame from "@/games/needledrop/NeedleDropGame";
import SpellDropGame from "@/games/spelldrop/SpellDropGame";
import TopTenGame from "@/games/top-ten/TopTenGame";
import { formatChartDate, getGameCacheKey, getPacificDateKey } from "@/lib/date";
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
  { id: "ranked-top-10", title: "Top 10", subtitle: "Drag the 10 items into the correct order." },
  { id: "spelldrop", title: "SpellDrop", subtitle: "Listen carefully and spell the word in one attempt." },
  { id: "closer", title: "Closer", subtitle: "Make one numeric guess and get as close as you can." },
  { id: "meet-me-halfway", title: "Meet Me Halfway", subtitle: "Drop a pin where you think the halfway point is." },
  { id: "landmark-drop", title: "Landmark Drop", subtitle: "Drop a pin where this landmark is located." }
];

type FeedMode = "daily" | "admin-preview";
type FlashTone = "green" | "red" | "amber";

function resultFlash(result: MinefieldGameResult): { title: string; detail: string; tone: FlashTone } {
  if (/unavailable/i.test(result.summaryLabel)) {
    return { title: "Unavailable today", detail: "Moving to the next game", tone: "amber" };
  }
  if (result.gameId === "needledrop") {
    return result.score > 0
      ? { title: "Correct", detail: `${result.score} points`, tone: "green" }
      : { title: "Missed", detail: "Answer saved for final review", tone: "red" };
  }
  if (result.gameId === "minefield") {
    const hitMine = result.reviewData?.type === "minefield" && result.reviewData.hitMine;
    return hitMine
      ? { title: "You hit a mine", detail: `${result.successUnits} safe tiles`, tone: "red" }
      : { title: "Score banked", detail: `${result.successUnits} safe tiles`, tone: result.score >= 80 ? "green" : "amber" };
  }
  if (result.gameId === "ranked-top-10") {
    return {
      title: result.score === 100 ? "Perfect ranking" : `${result.successUnits}/10 placed`,
      detail: `${result.score} points`,
      tone: result.score >= 80 ? "green" : result.score >= 30 ? "amber" : "red"
    };
  }
  if (result.gameId === "spelldrop") {
    return result.score > 0
      ? { title: "Correct", detail: "100 points", tone: "green" }
      : { title: "Misspelled", detail: "Answer saved for final review", tone: "red" };
  }
  if (result.gameId === "closer") {
    return result.score >= 65
      ? { title: "Very close", detail: `${result.score} points`, tone: "green" }
      : result.score >= 35
        ? { title: "Getting closer", detail: `${result.score} points`, tone: "amber" }
        : { title: "Way off", detail: `${result.score} points`, tone: "red" };
  }
  return result.score >= 65
    ? { title: "Close", detail: `${result.score} points`, tone: "green" }
    : result.score >= 30
      ? { title: "Not far", detail: `${result.score} points`, tone: "amber" }
      : { title: "Far off", detail: `${result.score} points`, tone: "red" };
}

export default function MinefieldFeed({
  dateOverride,
  mode = "daily"
}: {
  dateOverride?: string;
  mode?: FeedMode;
}) {
  const router = useRouter();
  const [liveDate, setLiveDate] = useState(() => getPacificDateKey());
  const date = dateOverride ?? liveDate;
  const storageScope = mode === "admin-preview" ? "admin-preview" : undefined;
  const startedKey = getGameCacheKey("minefield-started", date, storageScope);
  const [board, setBoard] = useState<MinefieldDailyBoard>({ date, results: {} });
  const [activeIndex, setActiveIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [completionResult, setCompletionResult] = useState<MinefieldGameResult | null>(null);

  useEffect(() => {
    if (dateOverride) return;
    const checkDate = () => setLiveDate((current) => {
      const next = getPacificDateKey();
      return next === current ? current : next;
    });
    const interval = window.setInterval(checkDate, 30_000);
    document.addEventListener("visibilitychange", checkDate);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", checkDate);
    };
  }, [dateOverride]);

  useEffect(() => {
    setReady(false);
    setCompletionResult(null);
    const loaded = loadGameProgress(date, storageScope);
    setBoard(loaded);
    setStarted(Boolean(localStorage.getItem(startedKey)) || Object.keys(loaded.results).length > 0);
    const firstIncomplete = GAMES.findIndex((game) => !loaded.results[game.id]?.completed);
    setActiveIndex(firstIncomplete === -1 ? GAMES.length : firstIncomplete);
    setReady(true);
  }, [date, startedKey, storageScope]);

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
      const next = saveGameProgress(current.date, result, storageScope);
      if (Object.values(next.results).filter((entry) => entry?.completed).length === GAMES.length) {
        completeDailyBoard(next, GAMES.length, storageScope);
      }
      return next;
    });
  }, [storageScope]);

  const goNext = useCallback(() => {
    setCompletionResult(null);
    setActiveIndex((index) => Math.min(index + 1, GAMES.length));
  }, []);

  const activeGame = GAMES[activeIndex];
  const activeComplete = activeGame ? Boolean(board.results[activeGame.id]?.completed) : false;

  useEffect(() => {
    if (!activeComplete || completionResult?.gameId !== activeGame?.id) return;
    const timeout = window.setTimeout(() => {
      if (activeIndex === GAMES.length - 1) {
        const modeQuery = mode === "admin-preview" ? "&mode=admin-preview" : "";
        router.push(`/review?date=${date}${modeQuery}`);
      } else {
        goNext();
      }
    }, 950);
    return () => window.clearTimeout(timeout);
  }, [activeComplete, activeGame?.id, activeIndex, completionResult, date, goNext, mode, router]);

  function startBoard() {
    localStorage.setItem(startedKey, "true");
    setStarted(true);
  }

  return (
    <div className="h-dvh overflow-hidden">
      <Header />
      <div className="flex h-[calc(100dvh-68px)] flex-col">
        <div className="z-20 flex h-14 shrink-0 items-center gap-4 border-b border-slate-200/70 bg-white/75 px-4 backdrop-blur-xl dark:border-white/[.07] dark:bg-[#111318]/80">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-950 dark:text-white">{formatChartDate(date)}</p>
            <p className="text-[10px] font-black uppercase tracking-[.15em] text-[#db4e36] dark:text-[#ff826a]">
              {mode === "admin-preview" ? "Admin preview mode" : "Today’s Minefield"}
            </p>
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
            <section className="grid h-full place-items-center px-4 text-sm font-bold text-slate-500">Preparing games…</section>
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
                  {mode === "admin-preview" ? "Start Preview Board" : "Start Today’s Board"}
                </button>
                <p className="mt-3 text-xs font-semibold text-slate-400">
                  {mode === "admin-preview" ? "Preview progress is isolated from daily play." : "Progress saves automatically on this device."}
                </p>
              </div>
            </section>
          ) : (
            <>
              {GAMES.map((game, index) => {
                const active = index === activeIndex;
                const result = board.results[game.id];
                const nextTitle = GAMES[index + 1]?.title ?? "Daily Results";
                const flash = result ? resultFlash(result) : null;
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
                            <NeedleDropGame onComplete={handleComplete} date={date} storageScope={storageScope} />
                          ) : game.id === "minefield" ? (
                            <MinefieldGame onComplete={handleComplete} date={date} storageScope={storageScope} />
                          ) : game.id === "ranked-top-10" ? (
                            <TopTenGame onComplete={handleComplete} date={date} storageScope={storageScope} />
                          ) : game.id === "spelldrop" ? (
                            <SpellDropGame onComplete={handleComplete} date={date} storageScope={storageScope} />
                          ) : game.id === "closer" ? (
                            <CloserGame onComplete={handleComplete} date={date} storageScope={storageScope} />
                          ) : game.id === "meet-me-halfway" ? (
                            <MeetMeHalfwayGame onComplete={handleComplete} date={date} storageScope={storageScope} />
                          ) : (
                            <LandmarkDropGame onComplete={handleComplete} date={date} storageScope={storageScope} />
                          )
                        )}
                      </MiniGameCard>

                      {active && activeComplete && result && flash && (
                        <div
                          role="status"
                          className={`absolute inset-x-3 bottom-3 z-30 animate-[pulse_.8s_ease-out_1] rounded-2xl border p-4 text-center shadow-2xl backdrop-blur-xl ${
                            flash.tone === "green"
                              ? "border-emerald-300 bg-emerald-500/95 text-white"
                              : flash.tone === "red"
                                ? "border-red-300 bg-red-500/95 text-white"
                                : "border-amber-300 bg-amber-400/95 text-slate-950"
                          }`}
                        >
                          <h3 className="text-xl font-black">{flash.title}</h3>
                          <p className="mt-0.5 text-sm font-bold opacity-90">{flash.detail}</p>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-wider opacity-75">
                            {activeIndex === GAMES.length - 1 ? "Opening results" : `Next: ${nextTitle}`}
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}

              <section
                aria-hidden={activeIndex !== GAMES.length}
                inert={activeIndex !== GAMES.length}
                className={`absolute inset-0 flex items-center justify-center overflow-y-auto px-3 py-3 transition-transform duration-500 ${
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
