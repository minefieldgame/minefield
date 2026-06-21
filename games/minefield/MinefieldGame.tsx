"use client";

import { useEffect, useMemo, useState } from "react";
import { getGameCacheKey, getPacificDateKey } from "@/lib/date";
import {
  minefieldScoreLabel,
  resolveMinefieldPuzzle
} from "@/games/minefield/logic";
import type { MinefieldGameResult } from "@/types/minefield";

type GridState = {
  date: string;
  path: number[];
  safePicks: number[];
  hitMine: boolean;
  completed: boolean;
  banked: boolean;
};

export default function MinefieldGame({
  onComplete,
  date: selectedDate,
  storageScope
}: {
  onComplete: (result: MinefieldGameResult) => void;
  date?: string;
  storageScope?: string;
}) {
  const date = selectedDate ?? getPacificDateKey();
  const storageKey = getGameCacheKey("minefield", date, storageScope);
  const puzzle = useMemo(() => resolveMinefieldPuzzle(date), [date]);
  const [state, setState] = useState<GridState>({
    date,
    path: [],
    safePicks: [],
    hitMine: false,
    completed: false,
    banked: false
  });
  const [flashMine, setFlashMine] = useState(false);

  function report(next: GridState) {
    const score = next.safePicks.length * 20;
    const label = minefieldScoreLabel(score, next.hitMine);
    onComplete({
      gameId: "minefield",
      displayName: "Minefield",
      icon: "💣",
      score,
      maxScore: 100,
      completed: true,
      successUnits: next.safePicks.length,
      totalUnits: 5,
      summaryLabel: label,
      shareLine: next.hitMine
        ? `💣 Minefield: ${score}/100, hit a mine`
        : `💣 Minefield: ${score}/100, ${next.safePicks.length} safe`,
      reviewData: {
        type: "minefield",
        minePositions: puzzle.minePositions,
        safePicks: next.safePicks,
        path: next.path,
        hitMine: next.hitMine
      },
      detail: label
    });
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as GridState;
      if (parsed.date !== date) {
        localStorage.removeItem(storageKey);
        return;
      }
      setState(parsed);
      if (parsed.completed) report(parsed);
    } catch {
      // Invalid local progress falls back to a fresh board.
    }
  }, [date, storageKey]);

  function persist(next: GridState) {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setState(next);
  }

  function pick(index: number) {
    if (state.completed || state.path.includes(index)) return;
    const hitMine = puzzle.minePositions.includes(index);
    const path = [...state.path, index];
    if (hitMine) {
      const next = { ...state, path, hitMine: true, completed: true };
      setFlashMine(true);
      persist(next);
      report(next);
      return;
    }
    const safePicks = [...state.safePicks, index];
    const completed = safePicks.length === puzzle.maxPicks;
    const next = { ...state, path, safePicks, completed };
    persist(next);
    if (completed) report(next);
  }

  function bank() {
    if (state.completed || state.safePicks.length === 0) return;
    const next = { ...state, completed: true, banked: true };
    persist(next);
    report(next);
  }

  return (
    <div className={flashMine ? "animate-shake" : ""}>
      <div className="flex items-center justify-between text-xs font-black">
        <span className="rounded-full bg-amber-500/10 px-3 py-1.5 text-amber-700 dark:text-amber-300">💣 3 hidden</span>
        <span className="text-slate-700 dark:text-white">{state.safePicks.length}/5 safe · {state.safePicks.length * 20} pts</span>
      </div>
      <div className="mx-auto mt-3 grid max-w-[310px] grid-cols-5 gap-2">
        {Array.from({ length: 25 }, (_, index) => {
          const safe = state.safePicks.includes(index);
          const mineHit = state.hitMine && state.path.at(-1) === index;
          return (
            <button
              key={index}
              type="button"
              aria-label={`Tile ${index + 1}${safe ? ", safe" : ""}${mineHit ? ", mine" : ""}`}
              disabled={state.completed || state.path.includes(index)}
              onClick={() => pick(index)}
              className={`aspect-square rounded-lg border text-lg font-black shadow-sm transition active:scale-90 ${
                mineHit
                  ? "border-red-500 bg-red-500 text-white"
                  : safe
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-slate-300 bg-slate-100 text-slate-400 hover:border-violet hover:bg-violet/10 dark:border-[#454c5a] dark:bg-[#292e38] dark:text-slate-500"
              }`}
            >
              {mineHit ? "💥" : safe ? "✓" : ""}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400">Pick up to five tiles. Bank before you hit a mine.</p>
      <button
        type="button"
        onClick={bank}
        disabled={state.completed || state.safePicks.length === 0}
        className="mt-3 h-12 w-full rounded-xl bg-[#202128] font-extrabold text-white shadow-md active:scale-[.98] disabled:opacity-35 dark:bg-white dark:text-[#171920]"
      >
        Bank {state.safePicks.length * 20} points
      </button>
    </div>
  );
}
