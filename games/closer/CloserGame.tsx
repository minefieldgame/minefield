"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { calculateCloserScore, parseNumericGuess } from "@/games/closer/providers";
import type { CloserPuzzle } from "@/games/closer/types";
import { getDailyGameDate } from "@/lib/date";
import { markContentUsed } from "@/lib/content/repeatPrevention";
import { fetchDailyPuzzle } from "@/lib/content/clientCache";
import type { MinefieldGameResult } from "@/types/minefield";

type CloserState = { date: string; rawGuess: string; numericGuess: number; completed: boolean; puzzle: CloserPuzzle };
const STORAGE_PREFIX = "minefield:closer:v2:";

export default function CloserGame({ onComplete }: { onComplete: (result: MinefieldGameResult) => void }) {
  const date = getDailyGameDate();
  const [puzzle, setPuzzle] = useState<CloserPuzzle | null>(null);
  const [input, setInput] = useState("");
  const [state, setState] = useState<CloserState | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const report = useCallback((next: CloserState) => {
    const result = calculateCloserScore(next.numericGuess, next.puzzle.answer);
    onComplete({
      gameId: "closer", displayName: "Closer", icon: "🎯", score: result.score, maxScore: 100,
      completed: true, successUnits: result.score >= 65 ? 1 : 0, totalUnits: 1,
      summaryLabel: result.scoreLabel,
      shareLine: `🎯 Closer: ${result.score}/100, ${result.scoreLabel.toLowerCase()}`,
      reviewData: {
        type: "closer", prompt: next.puzzle.prompt, userGuess: next.numericGuess,
        rawGuess: next.rawGuess, actualAnswer: next.puzzle.answer,
        displayAnswer: next.puzzle.displayAnswer, percentError: result.percentError,
        sourceNote: next.puzzle.sourceNote, scoreLabel: result.scoreLabel
      },
      detail: result.scoreLabel
    });
  }, [onComplete]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${date}`);
      if (stored) {
        const parsed = JSON.parse(stored) as CloserState;
        setPuzzle(parsed.puzzle); setState(parsed); setInput(parsed.rawGuess);
        if (parsed.completed) report(parsed);
        setLoading(false); return;
      }
    } catch {}
    fetchDailyPuzzle<CloserPuzzle>("closer", date, `/api/closer?date=${date}`)
      .then((loaded) => {
        setPuzzle(loaded);
        if (loaded.contentHash) markContentUsed({ gameId: "closer", contentHash: loaded.contentHash, topic: loaded.category, answer: String(loaded.answer), date });
      })
      .catch(() => {
        setError("Today’s Closer could not be generated.");
        onComplete({
          gameId: "closer", displayName: "Closer", icon: "🎯", score: 0, maxScore: 100,
          completed: true, successUnits: 0, totalUnits: 1, summaryLabel: "Unavailable today",
          shareLine: "🎯 Closer: unavailable",
          reviewData: { type: "legacy", message: "Today’s puzzle was unavailable." }
        });
      })
      .finally(() => setLoading(false));
  }, [date, onComplete, report]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!puzzle || state?.completed) return;
    const numericGuess = parseNumericGuess(input);
    if (numericGuess === null || (!puzzle.allowNegative && numericGuess < 0)) {
      setError("Enter a valid positive number, such as 1.5m or 500k."); return;
    }
    const next: CloserState = { date, puzzle, rawGuess: input.trim(), numericGuess, completed: true };
    localStorage.setItem(`${STORAGE_PREFIX}${date}`, JSON.stringify(next));
    setState(next); report(next);
  }

  if (loading) return <div className="py-10 text-center text-sm font-semibold text-slate-500">Generating today’s question…</div>;
  if (error || !puzzle) return <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">Today’s puzzle could not be generated. Moving on automatically.</div>;
  return (
    <div>
      <span className="rounded-full bg-violet/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-violet dark:bg-violet/25 dark:text-[#aaa2ff]">{puzzle.category}</span>
      <h3 className="mt-3 text-xl font-black leading-tight text-slate-950 dark:text-white">{puzzle.prompt}</h3>
      <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-300">Answer in {puzzle.unit} · one guess only</p>
      <form onSubmit={submit} className="mt-5">
        <input value={input} disabled={state?.completed} onChange={(event) => { setInput(event.target.value); setError(""); }}
          inputMode="decimal" placeholder="e.g. 1.5m, 500k, 8,848" autoComplete="off"
          className="h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-center text-lg font-black text-slate-950 outline-none focus:border-violet focus:ring-4 focus:ring-violet/15 dark:border-[#454c5a] dark:bg-[#252a34] dark:text-white" />
        {error && <p role="alert" className="mt-2 text-center text-xs font-bold text-red-600 dark:text-red-300">{error}</p>}
        {!state?.completed && <button disabled={!input.trim()} className="mt-3 h-12 w-full rounded-xl bg-violet font-extrabold text-white shadow-md disabled:opacity-35 dark:bg-[#7569e5]">Lock in guess</button>}
      </form>
    </div>
  );
}
