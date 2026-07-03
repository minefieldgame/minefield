"use client";

import { useCallback, useEffect, useState } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import ErrorState from "@/components/ErrorState";
import LoadingState from "@/components/LoadingState";
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
  const [state, setState] = useState<SingAlongState | null>(null);
  const [selectedChoiceId, setSelectedChoiceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const report = useCallback((next: SingAlongState) => {
    const selected = next.puzzle.choices.find((choice) => choice.id === next.selectedChoiceId);
    const correct = next.puzzle.choices.find((choice) => choice.isCorrect);
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
        songTitle: next.puzzle.songTitle,
        artist: next.puzzle.artist,
        chartDate: next.puzzle.chartDate,
        chartPosition: next.puzzle.chartPosition,
        playbackStart: next.puzzle.playbackStart,
        playbackStop: next.puzzle.playbackStop,
        chorusTimestamp: next.puzzle.chorusTimestamp,
        selectedChoice: selected?.text ?? "No choice",
        correctChoice: correct?.text ?? next.puzzle.acceptedLyric,
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
        if (parsed.dateKey === date && parsed.puzzle?.dateKey === date) {
          setPuzzle(parsed.puzzle);
          setSelectedChoiceId(parsed.selectedChoiceId);
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

  function choose(choiceId: string) {
    if (!puzzle || state?.completed) return;
    const choice = puzzle.choices.find((item) => item.id === choiceId);
    if (!choice) return;
    const correct = choice.isCorrect;
    const next: SingAlongState = {
      dateKey: date,
      puzzle,
      selectedChoiceId: choiceId,
      score: correct ? 100 : 0,
      label: correct ? "Perfect sing-along" : "Missed the lyric",
      completed: true,
      correct
    };
    localStorage.setItem(storageKey, JSON.stringify(next));
    setSelectedChoiceId(choiceId);
    setState(next);
    window.setTimeout(() => report(next), 650);
  }

  if (loading) return <LoadingState />;
  if (error || !puzzle) return <ErrorState message={error || "Today’s Sing Along puzzle could not be loaded."} retry={loadPuzzle} />;

  const clipDuration = Math.max(0.5, puzzle.playbackStop - puzzle.playbackStart);

  return (
    <div className="min-w-0 text-center">
      <p className="mx-auto max-w-sm text-xs font-semibold leading-5 text-slate-500 dark:text-slate-300">
        Listen to the clip, then pick the lyric you heard.
      </p>
      <AudioPlayer
        key={puzzle.id}
        src={puzzle.previewUrl}
        duration={clipDuration}
        startAt={puzzle.playbackStart}
        ended={Boolean(state?.completed)}
        playLabel="Play Sing Along clip"
      />
      <div className="mt-2 grid gap-2 text-left">
        {puzzle.choices.map((choice) => {
          const selected = selectedChoiceId === choice.id;
          const revealCorrect = Boolean(state?.completed && choice.isCorrect);
          const wrongSelected = Boolean(state?.completed && selected && !choice.isCorrect);
          return (
            <button
              key={choice.id}
              type="button"
              disabled={Boolean(state?.completed)}
              onClick={() => choose(choice.id)}
              className={`min-h-12 rounded-2xl border px-4 py-3 text-left text-sm font-black transition active:scale-[.98] ${
                revealCorrect
                  ? "border-emerald-300 bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                  : wrongSelected
                    ? "border-red-300 bg-red-500 text-white shadow-lg shadow-red-500/20"
                    : "border-slate-300 bg-white text-slate-900 hover:border-violet dark:border-[#454c5a] dark:bg-[#252a34] dark:text-white"
              }`}
            >
              <span className="mr-2 opacity-60">{choice.id.toUpperCase()}.</span>{choice.text}
            </button>
          );
        })}
      </div>
      {state?.completed && (
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
