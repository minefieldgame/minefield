"use client";

import { useCallback, useEffect, useState } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import ErrorState from "@/components/ErrorState";
import LoadingState from "@/components/LoadingState";
import { scoreSingAlongGuess } from "@/games/sing-along/logic";
import type { SingAlongPuzzle, SingAlongState } from "@/games/sing-along/types";
import { getGameCacheKey, getPacificDateKey } from "@/lib/date";
import type { MinefieldGameResult } from "@/types/minefield";

export default function SingAlongGame({
  onComplete,
  date: selectedDate,
  storageScope
}: {
  onComplete: (result: MinefieldGameResult) => void;
  date?: string;
  storageScope?: string;
}) {
  const date = selectedDate ?? getPacificDateKey();
  const storageKey = getGameCacheKey("sing-along", date, storageScope);
  const [puzzle, setPuzzle] = useState<SingAlongPuzzle | null>(null);
  const [guess, setGuess] = useState("");
  const [state, setState] = useState<SingAlongState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const report = useCallback((next: SingAlongState) => {
    onComplete({
      gameId: "sing-along",
      displayName: "Sing Along",
      icon: "🎤",
      score: next.score,
      maxScore: 100,
      completed: true,
      successUnits: next.correct ? 1 : 0,
      totalUnits: 1,
      summaryLabel: next.label,
      shareLine: `🎤 Sing Along: ${next.score}/100, ${next.label.toLowerCase()}`,
      reviewData: {
        type: "sing-along",
        songTitle: next.puzzle.title,
        artist: next.puzzle.artist,
        chartDate: next.puzzle.chartDate,
        chartPosition: next.puzzle.chartPosition,
        playbackStart: next.puzzle.playbackStart,
        playbackStop: next.puzzle.playbackStop,
        chorusTimestamp: next.puzzle.chorusTimestamp,
        userLyric: next.guess,
        acceptedLyric: next.puzzle.acceptedLyric,
        correct: next.correct
      },
      detail: next.label
    });
  }, [onComplete]);

  const loadPuzzle = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as SingAlongState;
        if (parsed.dateKey === date && parsed.puzzle?.date === date) {
          setPuzzle(parsed.puzzle);
          setGuess(parsed.guess);
          setState(parsed);
          if (parsed.completed) report(parsed);
          return;
        }
        localStorage.removeItem(storageKey);
      }

      const response = await fetch(`/api/sing-along?date=${date}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Today’s Sing Along puzzle could not be loaded.");
      setPuzzle(payload as SingAlongPuzzle);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Today’s Sing Along puzzle could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [date, report, storageKey]);

  useEffect(() => {
    loadPuzzle();
  }, [loadPuzzle]);

  function submit() {
    if (!puzzle || state?.completed) return;
    const scored = scoreSingAlongGuess(guess, [puzzle.acceptedLyric, ...puzzle.alternateAcceptedLyrics]);
    const next: SingAlongState = {
      dateKey: date,
      puzzle,
      guess: guess.trim(),
      score: scored.score,
      label: scored.label,
      completed: true,
      correct: scored.correct
    };
    localStorage.setItem(storageKey, JSON.stringify(next));
    setState(next);
    report(next);
  }

  if (loading) return <LoadingState />;
  if (error || !puzzle) return <ErrorState message={error || "Today’s Sing Along puzzle could not be loaded."} retry={loadPuzzle} />;

  const clipDuration = Math.max(0.5, puzzle.playbackStop - puzzle.playbackStart);

  return (
    <div className="min-w-0 text-center">
      <p className="mx-auto max-w-sm text-xs font-semibold leading-5 text-slate-500 dark:text-slate-300">
        Listen to the lead-in. The preview stops right before the hook.
      </p>
      <AudioPlayer
        key={puzzle.id}
        src={puzzle.track.previewUrl}
        duration={clipDuration}
        startAt={puzzle.playbackStart}
        ended={Boolean(state?.completed)}
        playLabel="Play Sing Along clip"
      />
      <div className="mt-2 text-left">
        <label htmlFor="sing-along-guess" className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">
          Next lyric
        </label>
        <input
          id="sing-along-guess"
          value={guess}
          disabled={Boolean(state?.completed)}
          onChange={(event) => setGuess(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          placeholder="Type what comes next"
          className="mt-2 h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-bold text-slate-950 outline-none transition focus:border-violet focus:ring-4 focus:ring-violet/15 disabled:opacity-70 dark:border-[#454c5a] dark:bg-[#252a34] dark:text-white"
        />
      </div>
      {!state?.completed ? (
        <button
          onClick={submit}
          disabled={!guess.trim()}
          className="mt-3 h-12 w-full rounded-xl bg-violet font-extrabold text-white shadow-md active:scale-[.98] disabled:opacity-35 dark:bg-[#7569e5]"
        >
          Submit lyric
        </button>
      ) : (
        <p className={`mt-3 rounded-xl px-4 py-3 text-sm font-black ${
          state.correct
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "bg-red-500/10 text-red-700 dark:text-red-300"
        }`}>
          {state.label} · {state.score} points
        </p>
      )}
    </div>
  );
}
