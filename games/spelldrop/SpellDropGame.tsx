"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { SpellDropPuzzle } from "@/games/spelldrop/types";
import { getGameCacheKey, getPacificDateKey } from "@/lib/date";
import { markContentUsed } from "@/lib/content/repeatPrevention";
import { fetchDailyPuzzle } from "@/lib/content/clientCache";
import type { MinefieldGameResult } from "@/types/minefield";

type SpellDropState = { date: string; guess: string; correct: boolean; completed: boolean; puzzle: SpellDropPuzzle };
const REPLAY_LIMIT = 2;

export default function SpellDropGame({
  onComplete,
  date: selectedDate,
  storageScope
}: {
  onComplete: (result: MinefieldGameResult) => void;
  date?: string;
  storageScope?: string;
}) {
  const date = selectedDate ?? getPacificDateKey();
  const storageKey = getGameCacheKey("spelldrop", date, storageScope);
  const [puzzle, setPuzzle] = useState<SpellDropPuzzle | null>(null);
  const [guess, setGuess] = useState("");
  const [plays, setPlays] = useState(0);
  const [state, setState] = useState<SpellDropState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const report = useCallback((result: SpellDropState) => {
    const score = result.correct ? 100 : 0;
    const summaryLabel = result.correct ? "Correct" : "Missed";
    onComplete({
      gameId: "spelldrop", displayName: "SpellDrop", icon: "🔤", score, maxScore: 100,
      completed: true, successUnits: result.correct ? 1 : 0, totalUnits: 1, summaryLabel,
      shareLine: `🔤 SpellDrop: ${score}/100, ${summaryLabel.toLowerCase()}`,
      reviewData: {
        type: "spelldrop", correctWord: result.puzzle.word, userSpelling: result.guess,
        correct: result.correct, definition: result.puzzle.definition
      },
      detail: summaryLabel
    });
  }, [onComplete]);

  useEffect(() => {
    setLoading(true);
    setError("");
    setPuzzle(null);
    setState(null);
    setGuess("");
    setPlays(0);
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as SpellDropState;
        if (parsed.date !== date || parsed.puzzle?.date !== date) {
          localStorage.removeItem(storageKey);
          throw new Error("Stale SpellDrop state");
        }
        setPuzzle(parsed.puzzle); setState(parsed); setGuess(parsed.guess);
        if (parsed.completed) report(parsed);
        setLoading(false); return;
      }
    } catch {}
    fetchDailyPuzzle<SpellDropPuzzle>("spelldrop", date, `/api/spelldrop?date=${date}`)
      .then((loaded) => {
        setPuzzle(loaded);
        if (!storageScope && loaded.contentHash) markContentUsed({ gameId: "spelldrop", contentHash: loaded.contentHash, topic: "spelling", answer: loaded.word, date });
      })
      .catch(() => {
        setError("Today’s puzzle could not be loaded.");
        onComplete({
          gameId: "spelldrop", displayName: "SpellDrop", icon: "🔤", score: 0, maxScore: 100,
          completed: true, successUnits: 0, totalUnits: 1, summaryLabel: "Unavailable today",
          shareLine: "🔤 SpellDrop: unavailable",
          reviewData: { type: "legacy", message: "Today’s puzzle could not be loaded." }
        });
      })
      .finally(() => setLoading(false));
  }, [date, onComplete, report, storageKey]);

  function speak() {
    if (!puzzle || !("speechSynthesis" in window) || plays >= REPLAY_LIMIT + 1) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(puzzle.word);
    utterance.rate = 0.78; utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
    setPlays((value) => value + 1);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!puzzle || state?.completed || !guess.trim()) return;
    const result: SpellDropState = {
      date, puzzle, guess: guess.trim(),
      correct: guess.trim().toLowerCase() === puzzle.word.toLowerCase(), completed: true
    };
    localStorage.setItem(storageKey, JSON.stringify(result));
    setState(result); report(result);
  }

  if (loading) return <div className="py-10 text-center text-sm font-semibold text-slate-500">Choosing today’s word…</div>;
  if (error || !puzzle) return <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">Today’s puzzle could not be loaded.</div>;
  const completed = Boolean(state?.completed);
  return (
    <div>
      <div className="rounded-xl border border-violet/15 bg-violet/5 p-4 text-center dark:border-violet/25 dark:bg-violet/10">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{puzzle.definition}</p>
        <button type="button" onClick={speak} disabled={completed || plays >= REPLAY_LIMIT + 1}
          className="mx-auto mt-3 flex h-12 items-center justify-center gap-3 rounded-xl bg-violet px-6 font-extrabold text-white shadow-md active:scale-[.97] disabled:opacity-45 dark:bg-[#7569e5]">
          <span aria-hidden="true">🔊</span>{plays === 0 ? "Play word" : "Play again"}
        </button>
        <p className="mt-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
          {plays === 0 ? "Two replays available" : `${Math.max(0, REPLAY_LIMIT - Math.max(0, plays - 1))} replays left`}
        </p>
      </div>
      <form onSubmit={submit} className="mt-3">
        <input value={guess} disabled={completed} onChange={(event) => setGuess(event.target.value)}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Type the spelling…"
          className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-center font-bold tracking-wide text-slate-950 outline-none focus:border-violet focus:ring-4 focus:ring-violet/15 dark:border-[#454c5a] dark:bg-[#252a34] dark:text-white" />
        {!completed && <button disabled={!guess.trim()} className="mt-2 h-12 w-full rounded-xl bg-[#202128] font-extrabold text-white active:scale-[.98] disabled:opacity-40 dark:bg-white dark:text-[#171920]">Submit spelling</button>}
      </form>
    </div>
  );
}
