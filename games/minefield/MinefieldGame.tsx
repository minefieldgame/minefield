"use client";

import { useEffect, useMemo, useState } from "react";
import { getGameCacheKey, getPacificDateKey } from "@/lib/date";
import {
  minefieldScore,
  minefieldScoreLabel,
  resolveMinefieldPuzzle
} from "@/games/minefield/logic";
import type { MinefieldGameResult } from "@/types/minefield";

type GridState = {
  date: string;
  difficulty: string;
  runScore: number;
  path: number[];
  safePicks: number[];
  hitMine: boolean;
  completed: boolean;
  banked: boolean;
};

export default function MinefieldGame({
  onComplete,
  date: selectedDate,
  storageScope,
  runScore,
  runMaxScore = 600
}: {
  onComplete: (result: MinefieldGameResult) => void;
  date?: string;
  storageScope?: string;
  runScore: number;
  runMaxScore?: number;
}) {
  const date = selectedDate ?? getPacificDateKey();
  const storageKey = getGameCacheKey("minefield", date, storageScope);
  const puzzle = useMemo(
    () => resolveMinefieldPuzzle(date, runScore, runMaxScore),
    [date, runMaxScore, runScore]
  );
  const freshState = useMemo<GridState>(() => ({
    date,
    difficulty: puzzle.difficulty,
    runScore,
    path: [],
    safePicks: [],
    hitMine: false,
    completed: false,
    banked: false
  }), [date, puzzle.difficulty, runScore]);
  const [state, setState] = useState<GridState>(freshState);
  const [phase, setPhase] = useState<"intro" | "playing" | "exploding" | "cleared">("intro");

  function report(next: GridState) {
    const score = minefieldScore(next.safePicks.length, puzzle.maxPicks);
    const label = minefieldScoreLabel(score, next.hitMine);
    onComplete({
      gameId: "minefield",
      displayName: "Minefield",
      icon: "💣",
      score,
      maxScore: 100,
      completed: true,
      successUnits: next.safePicks.length,
      totalUnits: puzzle.maxPicks,
      summaryLabel: label,
      shareLine: next.hitMine
        ? `💣 Minefield: ${score}/100, hit a mine on ${puzzle.difficulty.toLowerCase()}`
        : `💣 Minefield: ${score}/100, cleared ${puzzle.difficulty.toLowerCase()}`,
      reviewData: {
        type: "minefield",
        minePositions: puzzle.minePositions,
        safePicks: next.safePicks,
        path: next.path,
        hitMine: next.hitMine,
        difficulty: puzzle.difficulty,
        runScore: puzzle.runScore,
        runMaxScore: puzzle.runMaxScore,
        mineCount: puzzle.mineCount,
        maxPicks: puzzle.maxPicks
      },
      detail: label
    });
  }

  useEffect(() => {
    let resumed = false;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as GridState;
        if (
          parsed.date === date &&
          parsed.difficulty === puzzle.difficulty &&
          parsed.runScore === runScore
        ) {
          resumed = true;
          setState(parsed);
          setPhase(parsed.completed ? (parsed.hitMine ? "exploding" : "cleared") : "playing");
          if (parsed.completed) report(parsed);
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
    if (resumed) return;
    setState(freshState);
    setPhase("intro");
    const timeout = window.setTimeout(() => setPhase("playing"), 1200);
    return () => window.clearTimeout(timeout);
  }, [date, freshState, puzzle.difficulty, runScore, storageKey]);

  function persist(next: GridState) {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setState(next);
  }

  function finishWithAnimation(next: GridState, outcome: "exploding" | "cleared") {
    persist(next);
    setPhase(outcome);
    if ("vibrate" in navigator) navigator.vibrate(outcome === "exploding" ? [60, 40, 90] : 50);
    window.setTimeout(() => report(next), outcome === "exploding" ? 720 : 620);
  }

  function pick(index: number) {
    if (phase !== "playing" || state.completed || state.path.includes(index)) return;
    const hitMine = puzzle.minePositions.includes(index);
    const path = [...state.path, index];
    if (hitMine) {
      finishWithAnimation({ ...state, path, hitMine: true, completed: true }, "exploding");
      return;
    }
    const safePicks = [...state.safePicks, index];
    const completed = safePicks.length === puzzle.maxPicks;
    const next = { ...state, path, safePicks, completed };
    if (completed) finishWithAnimation(next, "cleared");
    else persist(next);
  }

  if (phase === "intro") {
    return (
      <div className="grid min-h-[390px] place-items-center rounded-3xl bg-[radial-gradient(circle_at_top,#312e81,#111827_65%)] p-6 text-center text-white shadow-2xl">
        <div className="animate-[pulse_1.1s_ease-in-out_1]">
          <p className="text-5xl" aria-hidden="true">💣</p>
          <p className="mt-4 text-xs font-black uppercase tracking-[.22em] text-amber-300">Final challenge</p>
          <h3 className="mt-2 text-3xl font-black">Minefield Difficulty: {puzzle.difficulty}</h3>
          <p className="mx-auto mt-3 max-w-xs text-sm font-semibold leading-6 text-indigo-100">
            You earned this difficulty by scoring {puzzle.runScore}/{puzzle.runMaxScore}.
          </p>
          <div className="mx-auto mt-5 flex max-w-xs justify-center gap-2 text-xs font-black">
            <span className="rounded-full bg-white/10 px-3 py-2">{puzzle.mineCount} mines</span>
            <span className="rounded-full bg-white/10 px-3 py-2">{puzzle.maxPicks} picks</span>
          </div>
        </div>
      </div>
    );
  }

  const score = minefieldScore(state.safePicks.length, puzzle.maxPicks);
  return (
    <div className={`relative overflow-hidden rounded-3xl p-3 transition ${
      phase === "exploding"
        ? "animate-shake bg-red-500/20 shadow-[0_0_60px_rgba(239,68,68,.7)]"
        : phase === "cleared"
          ? "bg-emerald-500/15 shadow-[0_0_55px_rgba(16,185,129,.5)]"
          : "bg-slate-950/[.03] dark:bg-white/[.03]"
    }`}>
      {(phase === "exploding" || phase === "cleared") && (
        <div className={`pointer-events-none absolute inset-0 z-20 grid place-items-center ${
          phase === "exploding" ? "bg-red-600/75" : "bg-emerald-500/75"
        } text-white backdrop-blur-[2px]`}>
          <div className="animate-[pulse_.55s_ease-out_1] text-center">
            <p className="text-6xl">{phase === "exploding" ? "💥" : "✓"}</p>
            <p className="mt-2 text-2xl font-black">{phase === "exploding" ? "You hit a mine" : "Minefield Cleared"}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-xs font-black">
        <span className="rounded-full bg-violet/10 px-3 py-1.5 text-violet dark:bg-violet/25 dark:text-[#aaa2ff]">
          {puzzle.difficulty}
        </span>
        <span className="text-slate-700 dark:text-white">
          {state.safePicks.length}/{puzzle.maxPicks} safe · {score} pts
        </span>
      </div>
      <div className="mx-auto mt-3 grid max-w-[360px] grid-cols-4 gap-2.5">
        {Array.from({ length: 16 }, (_, index) => {
          const safe = state.safePicks.includes(index);
          const mineHit = state.hitMine && state.path.at(-1) === index;
          return (
            <button
              key={index}
              type="button"
              aria-label={`Tile ${index + 1}${safe ? ", safe" : ""}${mineHit ? ", mine" : ""}`}
              disabled={phase !== "playing" || state.completed || state.path.includes(index)}
              onClick={() => pick(index)}
              className={`aspect-square rounded-2xl border text-2xl font-black shadow-md transition duration-200 active:scale-90 ${
                mineHit
                  ? "scale-110 border-red-300 bg-red-500 text-white shadow-[0_0_28px_rgba(239,68,68,.9)]"
                  : safe
                    ? "border-emerald-400 bg-emerald-500 text-white shadow-emerald-500/25"
                    : "border-slate-300 bg-gradient-to-br from-white to-slate-100 text-slate-400 hover:border-violet dark:border-[#454c5a] dark:from-[#343a47] dark:to-[#22262f] dark:text-slate-500"
              }`}
            >
              {mineHit ? "💥" : safe ? "✓" : ""}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        Survive {puzzle.maxPicks} picks to clear the final field.
      </p>
    </div>
  );
}
