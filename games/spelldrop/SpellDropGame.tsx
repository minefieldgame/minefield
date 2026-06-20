"use client";

import { FormEvent, useEffect, useState } from "react";
import { getDailyGameDate } from "@/lib/date";
import {
  checkSpelling,
  getSpellDropWord,
  SPELLDROP_REPLAY_LIMIT
} from "@/lib/spellDrop";
import type { MinefieldGameResult } from "@/types/minefield";

type SpellDropState = {
  date: string;
  guess: string;
  correct: boolean;
  completed: boolean;
};

const STORAGE_PREFIX = "minefield:spelldrop:v1:";

export default function SpellDropGame({
  onComplete
}: {
  onComplete: (result: MinefieldGameResult) => void;
}) {
  const date = getDailyGameDate();
  const { word } = getSpellDropWord(date);
  const [guess, setGuess] = useState("");
  const [plays, setPlays] = useState(0);
  const [state, setState] = useState<SpellDropState | null>(null);

  function report(result: SpellDropState) {
    const score = result.correct ? 100 : 0;
    const summaryLabel = result.correct ? "Correct" : "Missed";
    onComplete({
      gameId: "spelldrop",
      displayName: "SpellDrop",
      icon: "🔤",
      score,
      maxScore: 100,
      completed: true,
      successUnits: result.correct ? 1 : 0,
      totalUnits: 1,
      summaryLabel,
      shareLine: `🔤 SpellDrop: ${score}/100, ${summaryLabel.toLowerCase()}`,
      reviewData: {
        type: "spelldrop",
        correctWord: word,
        userSpelling: result.guess,
        correct: result.correct
      },
      detail: summaryLabel
    });
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${date}`);
      if (!stored) return;
      const parsed = JSON.parse(stored) as SpellDropState;
      setState(parsed);
      setGuess(parsed.guess);
      if (parsed.completed) report(parsed);
    } catch {
      // A damaged local entry should never prevent today's game.
    }
  }, [date]);

  function speak() {
    if (!("speechSynthesis" in window) || plays >= SPELLDROP_REPLAY_LIMIT + 1) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.rate = 0.78;
    utterance.pitch = 1;
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
    setPlays((value) => value + 1);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (state?.completed || !guess.trim()) return;
    const result: SpellDropState = {
      date,
      guess: guess.trim(),
      correct: checkSpelling(guess, word),
      completed: true
    };
    localStorage.setItem(`${STORAGE_PREFIX}${date}`, JSON.stringify(result));
    setState(result);
    report(result);
  }

  const completed = Boolean(state?.completed);
  const remainingReplays = Math.max(0, SPELLDROP_REPLAY_LIMIT - Math.max(0, plays - 1));
  return (
    <div>
      <div className="rounded-xl border border-violet/15 bg-violet/5 p-4 text-center dark:border-violet/25 dark:bg-violet/10">
        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Spell the word you hear.</p>
        <button
          type="button"
          onClick={speak}
          disabled={completed || plays >= SPELLDROP_REPLAY_LIMIT + 1}
          className="mx-auto mt-3 flex h-12 items-center justify-center gap-3 rounded-xl bg-violet px-6 font-extrabold text-white shadow-md shadow-violet/20 active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#7569e5]"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-current">
            <path d="M4 9v6h4l5 4V5L8 9H4Zm12.2-.7a1 1 0 0 0-1.4 1.4 3.25 3.25 0 0 1 0 4.6 1 1 0 1 0 1.4 1.4 5.25 5.25 0 0 0 0-7.4Zm2.8-2.8a1 1 0 1 0-1.4 1.4 7.2 7.2 0 0 1 0 10.2 1 1 0 1 0 1.4 1.4 9.2 9.2 0 0 0 0-13Z" />
          </svg>
          {plays === 0 ? "Play word" : "Play again"}
        </button>
        <p className="mt-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
          {plays === 0
            ? "2 replays available after the first play"
            : `${remainingReplays} ${remainingReplays === 1 ? "replay" : "replays"} left`}
        </p>
      </div>

      <form onSubmit={submit} className="mt-3">
        <label htmlFor="spelling-guess" className="sr-only">Type the spelling</label>
        <input
          id="spelling-guess"
          value={guess}
          disabled={completed}
          onChange={(event) => setGuess(event.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Type the spelling…"
          className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-center font-bold tracking-wide text-slate-950 outline-none focus:border-violet focus:ring-4 focus:ring-violet/15 disabled:bg-slate-100 dark:border-[#454c5a] dark:bg-[#252a34] dark:text-white dark:disabled:bg-[#20242c]"
        />
        {!completed && (
          <button disabled={!guess.trim()} className="mt-2 h-12 w-full rounded-xl bg-[#202128] font-extrabold text-white shadow-md active:scale-[.98] disabled:opacity-40 dark:bg-white dark:text-[#171920]">
            Submit spelling
          </button>
        )}
      </form>

    </div>
  );
}
