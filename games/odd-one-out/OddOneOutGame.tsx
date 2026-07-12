"use client";

import { useCallback, useEffect, useState } from "react";
import {
  assertPlayableOddOneOutPuzzle,
  normalizeOddOneOutItem
} from "@/games/odd-one-out/logic";
import type {
  OddOneOutApiPayload,
  OddOneOutPuzzle,
  OddOneOutState
} from "@/games/odd-one-out/types";
import { fetchDailyPuzzle } from "@/lib/content/clientCache";
import { getGameCacheKey, getPacificDateKey } from "@/lib/date";
import type { MinefieldGameResult } from "@/types/minefield";

const GAME_ID = "odd-one-out";

export default function OddOneOutGame({
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
  const [puzzle, setPuzzle] = useState<OddOneOutPuzzle | null>(null);
  const [state, setState] = useState<OddOneOutState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reportCompletion = useCallback((completed: OddOneOutState) => {
    const score = completed.correct ? 100 : 0;
    const summaryLabel = completed.correct ? "Found the odd one" : `Answer: ${completed.puzzle.answer}`;
    onComplete({
      gameId: GAME_ID,
      displayName: "Odd One Out",
      icon: "🧩",
      score,
      maxScore: 100,
      completed: true,
      successUnits: completed.correct ? 1 : 0,
      totalUnits: 1,
      summaryLabel,
      shareLine: `🧩 Odd One Out: ${score}/100, ${completed.correct ? "correct" : "missed"}`,
      reviewData: {
        type: GAME_ID,
        prompt: completed.puzzle.prompt,
        items: completed.puzzle.items,
        selectedItem: completed.selectedItem,
        correctItem: completed.puzzle.answer,
        correct: completed.correct,
        explanation: completed.puzzle.explanation,
        category: completed.puzzle.category,
        difficulty: completed.puzzle.difficulty
      },
      detail: summaryLabel
    });
  }, [onComplete]);

  useEffect(() => {
    setPuzzle(null);
    setState(null);
    setError("");
    setLoading(true);

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as OddOneOutState;
        const savedPuzzle = assertPlayableOddOneOutPuzzle(parsed.puzzle, date);
        if (parsed.date !== date || !parsed.completed || !parsed.selectedItem) {
          throw new Error("Stale Odd One Out state.");
        }
        const restored = { ...parsed, puzzle: savedPuzzle };
        setPuzzle(savedPuzzle);
        setState(restored);
        reportCompletion(restored);
        setLoading(false);
        return;
      }
    } catch {
      localStorage.removeItem(storageKey);
    }

    fetchDailyPuzzle<OddOneOutApiPayload>(GAME_ID, date, `/api/odd-one-out?date=${date}`)
      .then((payload) => {
        setPuzzle(assertPlayableOddOneOutPuzzle(payload, date));
      })
      .catch(() => {
        setError("Today’s Odd One Out puzzle could not be loaded.");
        onComplete({
          gameId: GAME_ID,
          displayName: "Odd One Out",
          icon: "🧩",
          score: 0,
          maxScore: 100,
          completed: true,
          successUnits: 0,
          totalUnits: 1,
          summaryLabel: "Unavailable today",
          shareLine: "🧩 Odd One Out: unavailable",
          reviewData: { type: "legacy", message: "Today’s Odd One Out puzzle was unavailable." }
        });
      })
      .finally(() => setLoading(false));
  }, [date, onComplete, reportCompletion, storageKey]);

  function selectItem(item: string) {
    if (!puzzle || state?.completed) return;
    const completed: OddOneOutState = {
      date,
      puzzle,
      selectedItem: item,
      correct: normalizeOddOneOutItem(item) === normalizeOddOneOutItem(puzzle.answer),
      completed: true
    };
    localStorage.setItem(storageKey, JSON.stringify(completed));
    setState(completed);
    reportCompletion(completed);
  }

  if (loading) {
    return <div className="py-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-300">Choosing today’s five items…</div>;
  }
  if (error || !puzzle) {
    return (
      <div role="status" className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
        Today’s Odd One Out puzzle could not be loaded. Moving to the next game.
      </div>
    );
  }

  const completed = Boolean(state?.completed);
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="max-w-full break-words rounded-full bg-violet/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-violet dark:bg-violet/25 dark:text-[#aaa2ff]">
          {puzzle.category}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600 dark:bg-[#292e38] dark:text-slate-300">
          {puzzle.difficulty}
        </span>
      </div>

      <h3 className="mt-3 break-words text-lg font-black leading-tight text-slate-950 dark:text-white">
        {puzzle.prompt}
      </h3>
      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Choose the one item that does not belong.</p>

      <div className="mt-4 grid gap-2" role="group" aria-label="Odd One Out choices">
        {puzzle.items.map((item) => {
          const isAnswer = normalizeOddOneOutItem(item) === normalizeOddOneOutItem(puzzle.answer);
          const isSelected = normalizeOddOneOutItem(item) === normalizeOddOneOutItem(state?.selectedItem ?? "");
          const wrongSelection = completed && isSelected && !isAnswer;
          const correctAnswer = completed && isAnswer;
          return (
            <button
              key={item}
              type="button"
              onClick={() => selectItem(item)}
              disabled={completed}
              aria-pressed={isSelected}
              aria-label={`Select ${item} as the odd one out`}
              className={`min-h-12 min-w-0 rounded-xl border px-4 py-3 text-left text-sm font-extrabold leading-snug shadow-sm outline-none transition focus-visible:ring-4 focus-visible:ring-violet/25 disabled:opacity-100 sm:text-base ${
                correctAnswer
                  ? "border-emerald-500 bg-emerald-500 text-white shadow-emerald-500/20"
                  : wrongSelection
                    ? "border-red-500 bg-red-500 text-white shadow-red-500/20"
                    : completed
                      ? "border-slate-200 bg-slate-100 text-slate-500 dark:border-[#3b424f] dark:bg-[#292e38] dark:text-slate-400"
                      : "border-slate-200 bg-white text-slate-800 hover:border-violet hover:bg-violet/5 active:scale-[.99] dark:border-[#3b424f] dark:bg-[#252a34] dark:text-white dark:hover:border-[#7569e5]"
              }`}
            >
              <span className="flex min-w-0 items-center justify-between gap-3">
                <span className="min-w-0 break-words">{item}</span>
                {correctAnswer && <span aria-hidden="true" className="shrink-0">✓</span>}
                {wrongSelection && <span aria-hidden="true" className="shrink-0">×</span>}
              </span>
            </button>
          );
        })}
      </div>

      {completed && state && (
        <div
          role="status"
          aria-live="polite"
          className={`mt-3 rounded-xl border p-3 ${
            state.correct
              ? "border-emerald-300 bg-emerald-500/10"
              : "border-red-300 bg-red-500/10"
          }`}
        >
          <p className={`text-sm font-black ${state.correct ? "text-emerald-800 dark:text-emerald-200" : "text-red-800 dark:text-red-200"}`}>
            {state.correct ? "Correct — you found the odd one out." : `Not quite — ${puzzle.answer} is the odd one out.`}
          </p>
          <p className="mt-1 break-words text-sm font-semibold leading-5 text-slate-700 dark:text-slate-200">
            {puzzle.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
