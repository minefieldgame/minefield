"use client";

import { FormEvent, useMemo, useState, useEffect } from "react";
import {
  calculateCloserScore,
  parseNumericGuess,
  resolveCloserPuzzleForDate
} from "@/games/closer/providers";
import { getDailyGameDate } from "@/lib/date";
import type { MinefieldGameResult } from "@/types/minefield";

type CloserState = {
  date: string;
  rawGuess: string;
  numericGuess: number;
  completed: boolean;
};

const STORAGE_PREFIX = "minefield:closer:v1:";

export default function CloserGame({ onComplete }: { onComplete: (result: MinefieldGameResult) => void }) {
  const date = getDailyGameDate();
  const puzzle = useMemo(() => resolveCloserPuzzleForDate(date), [date]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<CloserState | null>(null);
  const [error, setError] = useState("");

  function report(next: CloserState) {
    const result = calculateCloserScore(next.numericGuess, puzzle.answer);
    onComplete({
      gameId: "closer",
      displayName: "Closer",
      icon: "🎯",
      score: result.score,
      maxScore: 100,
      completed: true,
      successUnits: result.score >= 65 ? 1 : 0,
      totalUnits: 1,
      summaryLabel: result.scoreLabel,
      shareLine: `🎯 Closer: ${result.score}/100, ${result.scoreLabel.toLowerCase()}`,
      reviewData: {
        type: "closer",
        prompt: puzzle.prompt,
        userGuess: next.numericGuess,
        rawGuess: next.rawGuess,
        actualAnswer: puzzle.answer,
        displayAnswer: puzzle.displayAnswer,
        percentError: result.percentError,
        sourceNote: puzzle.sourceNote,
        scoreLabel: result.scoreLabel
      },
      detail: result.scoreLabel
    });
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${date}`);
      if (!stored) return;
      const parsed = JSON.parse(stored) as CloserState;
      setState(parsed);
      setInput(parsed.rawGuess);
      if (parsed.completed) report(parsed);
    } catch {
      // Invalid local progress falls back to a fresh question.
    }
  }, [date]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (state?.completed) return;
    const numericGuess = parseNumericGuess(input);
    if (numericGuess === null || (!puzzle.allowNegative && numericGuess < 0)) {
      setError("Enter a valid positive number, such as 1.5m or 500k.");
      return;
    }
    const next: CloserState = {
      date,
      rawGuess: input.trim(),
      numericGuess,
      completed: true
    };
    localStorage.setItem(`${STORAGE_PREFIX}${date}`, JSON.stringify(next));
    setState(next);
    report(next);
  }

  return (
    <div>
      <span className="rounded-full bg-violet/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-violet dark:bg-violet/25 dark:text-[#aaa2ff]">{puzzle.category}</span>
      <h3 className="mt-3 text-xl font-black leading-tight text-slate-950 dark:text-white">{puzzle.prompt}</h3>
      <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-300">Answer in {puzzle.unit} · one guess only</p>
      <form onSubmit={submit} className="mt-5">
        <label htmlFor="closer-guess" className="sr-only">Your numeric guess</label>
        <input
          id="closer-guess"
          value={input}
          disabled={state?.completed}
          onChange={(event) => { setInput(event.target.value); setError(""); }}
          inputMode="decimal"
          placeholder="e.g. 1.5m, 500k, 8,848"
          autoComplete="off"
          className="h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-center text-lg font-black text-slate-950 outline-none focus:border-violet focus:ring-4 focus:ring-violet/15 disabled:bg-slate-100 dark:border-[#454c5a] dark:bg-[#252a34] dark:text-white dark:disabled:bg-[#20242c]"
        />
        {error && <p role="alert" className="mt-2 text-center text-xs font-bold text-red-600 dark:text-red-300">{error}</p>}
        {!state?.completed && (
          <button disabled={!input.trim()} className="mt-3 h-12 w-full rounded-xl bg-violet font-extrabold text-white shadow-md disabled:opacity-35 dark:bg-[#7569e5]">
            Lock in guess
          </button>
        )}
      </form>
    </div>
  );
}
