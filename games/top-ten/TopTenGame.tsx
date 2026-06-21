"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  correctOrder,
  evaluateRankedOrder,
  initialRankedOrder,
  moveAmongUnlocked,
  rankedTopTenLabel,
  rankedTopTenScore
} from "@/games/top-ten/logic";
import type { RankedTopTenPuzzle, RankedTopTenState } from "@/games/top-ten/types";
import { fetchDailyPuzzle } from "@/lib/content/clientCache";
import { getGameCacheKey, getPacificDateKey } from "@/lib/date";
import type { MinefieldGameResult } from "@/types/minefield";

const GAME_ID = "ranked-top-10";
const MAX_ATTEMPTS = 3;

export const topTenDefinition = {
  gameId: "ranked-top-10" as const,
  displayName: "Top 10",
  maxScore: 100
};

export default function TopTenGame({
  onComplete,
  date: selectedDate,
  storageScope
}: {
  onComplete: (result: MinefieldGameResult) => void;
  date?: string;
  storageScope?: string;
}) {
  const date = selectedDate ?? getPacificDateKey();
  const storageKey = getGameCacheKey(GAME_ID, date, storageScope);
  const [state, setState] = useState<RankedTopTenState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draggedAnswer, setDraggedAnswer] = useState<string | null>(null);
  const [feedbackPositions, setFeedbackPositions] = useState<number[]>([]);

  const reportCompletion = useCallback((next: RankedTopTenState) => {
    const score = rankedTopTenScore(next.lockedPositions);
    const placed = next.lockedPositions.length;
    const label = rankedTopTenLabel(score);
    onComplete({
      gameId: GAME_ID,
      displayName: "Top 10",
      icon: "🏆",
      score,
      maxScore: 100,
      completed: true,
      successUnits: placed,
      totalUnits: 10,
      summaryLabel: score === 100 ? label : `${placed}/10 placed`,
      shareLine: score === 100
        ? "🏆 Top 10: 100/100, perfect ranking"
        : `🏆 Top 10: ${score}/100, ${placed}/10 placed`,
      reviewData: {
        type: "ranked-top-10",
        prompt: next.puzzle.playerPrompt,
        userOrder: next.order,
        correctOrder: correctOrder(next.puzzle),
        correctPositions: next.lockedPositions,
        attemptsUsed: next.attemptsUsed
      },
      detail: label
    });
  }, [onComplete]);

  useEffect(() => {
    setLoading(true);
    setError("");
    setState(null);
    setFeedbackPositions([]);
    setDraggedAnswer(null);
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as RankedTopTenState;
        if (parsed.dateKey === date && parsed.puzzle?.date === date && parsed.puzzle.gameId === GAME_ID) {
          setState(parsed);
          if (parsed.status !== "playing") reportCompletion(parsed);
          setLoading(false);
          return;
        }
      }
    } catch {
      localStorage.removeItem(storageKey);
    }

    fetchDailyPuzzle<RankedTopTenPuzzle>(GAME_ID, date, `/api/top-ten/generate?date=${date}`)
      .then((puzzle) => {
        if (puzzle.date !== date || puzzle.gameId !== GAME_ID) {
          throw new Error("Ranked Top 10 returned the wrong date.");
        }
        const next: RankedTopTenState = {
          dateKey: date,
          puzzle,
          order: initialRankedOrder(puzzle),
          lockedPositions: [],
          attemptsUsed: 0,
          lastIncorrectPositions: [],
          status: "playing",
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem(storageKey, JSON.stringify(next));
        setState(next);
      })
      .catch(() => {
        setError("Today’s Top 10 could not be loaded.");
        onComplete({
          gameId: GAME_ID,
          displayName: "Top 10",
          icon: "🏆",
          score: 0,
          maxScore: 100,
          completed: true,
          successUnits: 0,
          totalUnits: 10,
          summaryLabel: "Unavailable today",
          shareLine: "🏆 Top 10: unavailable",
          reviewData: { type: "legacy", message: "Today’s puzzle was unavailable." }
        });
      })
      .finally(() => setLoading(false));
  }, [date, onComplete, reportCompletion, storageKey]);

  function persist(next: RankedTopTenState) {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setState(next);
  }

  function move(fromIndex: number, toIndex: number) {
    if (!state || state.status !== "playing") return;
    const order = moveAmongUnlocked(state.order, fromIndex, toIndex, state.lockedPositions);
    if (order === state.order) return;
    setFeedbackPositions([]);
    persist({ ...state, order, updatedAt: new Date().toISOString() });
  }

  function moveDirection(index: number, direction: -1 | 1) {
    if (!state) return;
    const locked = new Set(state.lockedPositions);
    let target = index + direction;
    while (target >= 0 && target < state.order.length && locked.has(target)) target += direction;
    if (target >= 0 && target < state.order.length) move(index, target);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!state || !draggedAnswer) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-order-index]");
    if (!target) return;
    const fromIndex = state.order.indexOf(draggedAnswer);
    const toIndex = Number(target.dataset.orderIndex);
    if (Number.isInteger(toIndex) && fromIndex !== toIndex) move(fromIndex, toIndex);
  }

  function submit() {
    if (!state || state.status !== "playing") return;
    const correctPositions = evaluateRankedOrder(state.order, state.puzzle);
    const lockedPositions = [...new Set([...state.lockedPositions, ...correctPositions])].sort((a, b) => a - b);
    const incorrectPositions = state.order.map((_, index) => index).filter((index) => !lockedPositions.includes(index));
    const attemptsUsed = state.attemptsUsed + 1;
    const completed = lockedPositions.length === 10 || attemptsUsed >= MAX_ATTEMPTS;
    const next: RankedTopTenState = {
      ...state,
      lockedPositions,
      attemptsUsed,
      lastIncorrectPositions: incorrectPositions,
      status: completed ? "completed" : "playing",
      updatedAt: new Date().toISOString()
    };
    setFeedbackPositions(incorrectPositions);
    window.setTimeout(() => setFeedbackPositions([]), 700);
    persist(next);
    if (completed) reportCompletion(next);
  }

  function giveUp() {
    if (!state || state.status !== "playing") return;
    const lockedPositions = [...new Set([
      ...state.lockedPositions,
      ...evaluateRankedOrder(state.order, state.puzzle)
    ])].sort((a, b) => a - b);
    const next: RankedTopTenState = {
      ...state,
      lockedPositions,
      status: "gave-up",
      updatedAt: new Date().toISOString()
    };
    persist(next);
    reportCompletion(next);
  }

  const answerLabels = useMemo(
    () => new Map(state?.puzzle.answers.map((answer) => [answer.answer, answer.displayAnswer || answer.answer]) ?? []),
    [state?.puzzle.answers]
  );

  if (loading) {
    return <div className="py-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-300">Building today’s ranking…</div>;
  }
  if (error || !state) {
    return <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">Today’s Top 10 is unavailable. Moving on automatically.</div>;
  }

  const ended = state.status !== "playing";
  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerUp={() => setDraggedAnswer(null)}
      onPointerCancel={() => setDraggedAnswer(null)}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-violet/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-violet dark:bg-violet/25 dark:text-[#aaa2ff]">
          {state.puzzle.category}
        </span>
        <span className="shrink-0 text-xs font-black text-slate-600 dark:text-slate-200">
          Attempt {Math.min(state.attemptsUsed + 1, MAX_ATTEMPTS)} of {MAX_ATTEMPTS}
        </span>
      </div>
      <h3 className="mt-2 text-base font-black leading-tight text-slate-950 dark:text-white">
        {state.puzzle.playerPrompt}
      </h3>

      <div className="mt-3 space-y-1.5">
        {state.order.map((answer, index) => {
          const locked = state.lockedPositions.includes(index);
          const incorrect = feedbackPositions.includes(index);
          return (
            <div
              key={answer}
              data-order-index={index}
              className={`flex min-h-10 items-center gap-2 rounded-xl border px-2 py-1.5 transition ${
                locked
                  ? "border-emerald-400 bg-emerald-500/12 text-emerald-800 dark:border-emerald-400/40 dark:text-emerald-200"
                  : incorrect
                    ? "border-red-400 bg-red-500/10 text-red-800 dark:border-red-400/40 dark:text-red-200"
                    : draggedAnswer === answer
                      ? "border-violet bg-violet/10 shadow-lg"
                      : "border-slate-200 bg-white text-slate-800 dark:border-[#3b424f] dark:bg-[#252a34] dark:text-white"
              }`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-black/[.05] text-xs font-black dark:bg-white/[.07]">
                {index + 1}
              </span>
              <button
                type="button"
                disabled={locked || ended}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDraggedAnswer(answer);
                }}
                className="touch-none select-none text-slate-400 disabled:cursor-default"
                aria-label={locked ? `${answer} locked` : `Drag ${answer}`}
              >
                {locked ? "✓" : "☰"}
              </button>
              <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{answerLabels.get(answer)}</span>
              {!locked && !ended && (
                <span className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => moveDirection(index, -1)} className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-xs dark:bg-[#343a47]" aria-label={`Move ${answer} up`}>↑</button>
                  <button type="button" onClick={() => moveDirection(index, 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-xs dark:bg-[#343a47]" aria-label={`Move ${answer} down`}>↓</button>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {!ended && (
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <button onClick={submit} className="h-11 rounded-xl bg-violet px-5 text-sm font-extrabold text-white shadow-md dark:bg-[#7569e5]">
            Submit ranking
          </button>
          <button onClick={giveUp} className="h-11 rounded-xl px-4 text-sm font-bold text-slate-500 hover:bg-red-50 hover:text-red-700 dark:text-slate-400 dark:hover:bg-red-400/10 dark:hover:text-red-300">
            Give Up
          </button>
        </div>
      )}
    </div>
  );
}
