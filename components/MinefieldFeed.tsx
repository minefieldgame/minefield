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
import OddOneOutGame from "@/games/odd-one-out/OddOneOutGame";
import VaultbreakGame from "@/games/vaultbreak/VaultbreakGame";
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
import { ACTIVE_GAME_IDS, GAME_DISPLAY, PRELIMINARY_GAME_IDS } from "@/lib/gameDisplay";

const GAMES: Array<{ id: MinefieldGameId; title: string; subtitle: string }> = ACTIVE_GAME_IDS.map((id) => ({
  id,
  title: GAME_DISPLAY[id].name,
  subtitle: GAME_DISPLAY[id].instruction
}));

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
  if (result.gameId === "odd-one-out") {
    const review = result.reviewData.type === "odd-one-out" ? result.reviewData : null;
    return result.score > 0
      ? { title: "Odd one found", detail: review?.explanation ?? `${result.score} points`, tone: "green" }
      : {
          title: review ? `Correct: ${review.correctItem}` : "Not the odd one",
          detail: review?.explanation ?? "Correct answer revealed",
          tone: "red"
        };
  }
  if (result.gameId === "vaultbreak") {
    const review = result.reviewData.type === "vaultbreak" ? result.reviewData : null;
    return review?.opened
      ? { title: "Vault opened", detail: `${result.score} points · ${review.elapsedSeconds}s`, tone: "green" }
      : {
          title: "Lock jammed",
          detail: review ? `${review.exactDigits}/4 digits exact · code ${review.correctCode}` : `${result.score} points`,
          tone: review?.exactDigits ? "amber" : "red"
        };
  }
  if (result.gameId === "minefield") {
    const hitMine = result.reviewData?.type === "minefield" && result.reviewData.hitMine;
    return hitMine
      ? { title: "You hit a mine", detail: `${result.successUnits} safe tiles`, tone: "red" }
      : { title: "Minefield Cleared", detail: `${result.score} points`, tone: "green" };
  }
  if (result.gameId === "ranked-top-5") {
    return {
      title: result.score === 100 ? "Perfect ranking" : `${result.successUnits}/5 placed`,
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
    return {
      title: result.summaryLabel,
      detail: `${result.score} points`,
      tone: result.score >= 65 ? "green" : result.score >= 35 ? "amber" : "red"
    };
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
    const legacyMinefield = loaded.results.minefield?.reviewData.type === "minefield" &&
      !loaded.results.minefield.reviewData.difficulty;
    const normalized = legacyMinefield
      ? { ...loaded, results: { ...loaded.results, minefield: undefined } }
      : loaded;
    setBoard(normalized);
    setStarted(Boolean(localStorage.getItem(startedKey)) || Object.keys(normalized.results).length > 0);
    const firstIncomplete = GAMES.findIndex((game) => !normalized.results[game.id]?.completed);
    setActiveIndex(firstIncomplete === -1 ? GAMES.length : firstIncomplete);
    setReady(true);
  }, [date, startedKey, storageScope]);

  const summary = useMemo(() => calculateDailySummary(board, GAMES.length), [board]);
  const runPerformance = useMemo(() => PRELIMINARY_GAME_IDS.reduce((total, gameId) => {
    return total + (board.results[gameId]?.score ?? 0);
  }, 0), [board.results]);

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
    }, activeGame?.id === "vaultbreak" ? 5_000 : activeGame?.id === "odd-one-out" ? 1_800 : 950);
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
        <div className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200/70 bg-white/75 px-3 backdrop-blur-xl dark:border-white/[.07] dark:bg-[#111318]/80 sm:gap-4 sm:px-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-slate-950 dark:text-white">{formatChartDate(date)}</p>
            <p className="text-[10px] font-black uppercase tracking-[.15em] text-[#db4e36] dark:text-[#ff826a]">
              {mode === "admin-preview" ? "Admin preview mode" : "Today’s Minefield"}
            </p>
          </div>
          <div className="ml-auto flex w-20 shrink-0 gap-1 sm:w-36 sm:gap-1.5">
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
          <span className="shrink-0 text-xs font-black text-violet dark:text-[#9187f6] sm:text-sm">{runPerformance}/800</span>
        </div>

        <main className="relative flex-1 overflow-hidden">
          {!ready ? (
            <section className="grid h-full place-items-center px-4 text-sm font-bold text-slate-500">Preparing games…</section>
          ) : !started ? (
            <section className="h-full overflow-y-auto overscroll-contain px-3 py-3">
              <div className="mx-auto flex min-h-full max-w-xl items-center">
              <div className="theme-surface w-full rounded-[1.5rem] border p-4 text-center sm:rounded-[2rem] sm:p-9">
                <div className="mx-auto flex h-20 items-center justify-center sm:h-28">
                  <BrandLogo priority className="h-20 w-auto max-w-full object-contain drop-shadow-xl sm:h-28" />
                </div>
                <p className="mt-6 text-xs font-black uppercase tracking-[.22em] text-coral">Nine quick games · daily</p>
                <h1 className="mt-2 text-3xl font-black tracking-[-.05em] text-slate-950 dark:text-white sm:text-4xl">Minefield</h1>
                <p className="mx-auto mt-3 max-w-sm text-base font-semibold leading-7 text-slate-500 dark:text-slate-300">
                  A daily collection of quick trivia, logic, and skill games.
                </p>
                <div className="mx-auto mt-5 max-w-sm text-left">
                  <div className="grid grid-cols-2 gap-2">
                    {GAMES.slice(0, -1).map((game) => (
                      <div key={game.id} className="theme-muted rounded-xl px-3 py-2 text-xs font-extrabold text-slate-700 dark:text-slate-200">
                        {GAME_DISPLAY[game.id].icon} {game.title}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-2xl border border-violet/25 bg-violet/10 px-4 py-3 text-center">
                    <p className="font-black text-slate-950 dark:text-white">💣 Minefield</p>
                    <p className="text-[10px] font-black uppercase tracking-[.16em] text-violet dark:text-[#aaa2ff]">Final Challenge</p>
                  </div>
                </div>
                <button onClick={startBoard} className="mt-7 h-14 w-full rounded-2xl bg-violet px-6 font-extrabold text-white shadow-lg shadow-violet/25 active:scale-[.98] dark:bg-[#7569e5]">
                  {mode === "admin-preview" ? "Start Preview Board" : "Start Today’s Board"}
                </button>
                <p className="mt-3 text-xs font-semibold text-slate-400">
                  {mode === "admin-preview" ? "Preview progress is isolated from daily play." : "Progress saves automatically on this device."}
                </p>
              </div>
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
                    className={`absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain px-2.5 py-2 transition-transform duration-500 ease-[cubic-bezier(.22,.8,.3,1)] sm:px-3 sm:py-3 ${
                      active ? "pointer-events-auto" : "pointer-events-none"
                    }`}
                    style={{ transform: `translateY(${(index - activeIndex) * 100}%)` }}
                  >
                    <div className="relative mx-auto flex min-h-full w-full max-w-xl items-center">
                      <div className="relative w-full min-w-0">
                      <MiniGameCard number={index + 1} title={game.title} subtitle={game.subtitle}>
                        {active && (
                          game.id === "needledrop" ? (
                            <NeedleDropGame onComplete={handleComplete} date={date} storageScope={storageScope} />
                          ) : game.id === "odd-one-out" ? (
                            <OddOneOutGame onComplete={handleComplete} date={date} storageScope={storageScope} />
                          ) : game.id === "vaultbreak" ? (
                            <VaultbreakGame onComplete={handleComplete} date={date} storageScope={storageScope} />
                          ) : game.id === "minefield" ? (
                            <MinefieldGame
                              onComplete={handleComplete}
                              date={date}
                              storageScope={storageScope}
                              runScore={runPerformance}
                              runMaxScore={800}
                            />
                          ) : game.id === "ranked-top-5" ? (
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
                          <p className="mt-0.5 break-words text-sm font-bold opacity-90">{flash.detail}</p>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-wider opacity-75">
                            {activeIndex === GAMES.length - 1 ? "Opening results" : `Next: ${nextTitle}`}
                          </p>
                        </div>
                      )}
                      </div>
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
