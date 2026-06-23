"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import InteractiveGuessMap, { type MapPoint } from "@/components/InteractiveGuessMap";
import { calculateMeetMeHalfwayScore, type GeographyScoreResult } from "@/games/geography/logic";
import { resolveMeetMeHalfwayPuzzle } from "@/games/geography/puzzles";
import { getGameCacheKey, getPacificDateKey } from "@/lib/date";
import type { MinefieldGameResult } from "@/types/minefield";

type State = { dateKey: string; guess: MapPoint; distanceKm: number; score: number; completed: boolean; diagnostics: GeographyScoreResult };
export default function MeetMeHalfwayGame({
  onComplete,
  date: selectedDate,
  storageScope
}: {
  onComplete: (result: MinefieldGameResult) => void;
  date?: string;
  storageScope?: string;
}) {
  const date = selectedDate ?? getPacificDateKey();
  const storageKey = getGameCacheKey("meet-me-halfway", date, storageScope);
  const puzzle = useMemo(() => resolveMeetMeHalfwayPuzzle(date), [date]);
  const [guess, setGuess] = useState<MapPoint | null>(null);
  const [state, setState] = useState<State | null>(null);

  const report = useCallback((next: State) => {
    const label = next.diagnostics.label;
    onComplete({
      gameId: "meet-me-halfway", displayName: "Meet Me Halfway", icon: "🌍",
      score: next.score, maxScore: 100, completed: true, successUnits: next.score >= 65 ? 1 : 0,
      totalUnits: 1, summaryLabel: `${label} · ${Math.round(next.distanceKm).toLocaleString()} km`,
      shareLine: `🌍 Meet Me Halfway: ${next.score}/100, ${label.toLowerCase()}`,
      reviewData: {
        type: "meet-me-halfway", locationA: puzzle.locationA, locationB: puzzle.locationB,
        midpoint: puzzle.midpoint, guess: next.guess, distanceKm: next.distanceKm,
        scoringDiagnostics: next.diagnostics
      }
    });
  }, [onComplete, puzzle]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as State;
      if (parsed.dateKey !== date) {
        localStorage.removeItem(storageKey);
        return;
      }
      const restored = parsed.diagnostics ? parsed : {
        ...parsed,
        diagnostics: calculateMeetMeHalfwayScore(parsed.guess, puzzle.midpoint)
      };
      setState(restored); setGuess(restored.guess);
      if (restored.completed) report(restored);
    } catch {}
  }, [date, report, storageKey]);

  function submit() {
    if (!guess || state?.completed) return;
    const diagnostics = calculateMeetMeHalfwayScore(guess, puzzle.midpoint);
    const next = { dateKey: date, guess, distanceKm: diagnostics.distanceKm, score: diagnostics.finalScore, completed: true, diagnostics };
    localStorage.setItem(storageKey, JSON.stringify(next));
    setState(next); report(next);
  }

  return (
    <div className="min-w-0">
      <div className="mb-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-1.5 text-center sm:gap-2">
        <div className="min-w-0 rounded-xl bg-slate-100 px-1.5 py-2 dark:bg-[#292e38] sm:px-2">
          <p className="break-words text-xs font-black leading-tight text-slate-950 dark:text-white sm:text-sm">{puzzle.locationA.name}</p>
          <p className="mt-1 break-words text-[9px] font-bold leading-tight text-slate-500 sm:text-[10px]">{puzzle.locationA.country}</p>
        </div>
        <span className="text-lg font-black text-violet">↔</span>
        <div className="min-w-0 rounded-xl bg-slate-100 px-1.5 py-2 dark:bg-[#292e38] sm:px-2">
          <p className="break-words text-xs font-black leading-tight text-slate-950 dark:text-white sm:text-sm">{puzzle.locationB.name}</p>
          <p className="mt-1 break-words text-[9px] font-bold leading-tight text-slate-500 sm:text-[10px]">{puzzle.locationB.country}</p>
        </div>
      </div>
      <InteractiveGuessMap guess={guess} onGuess={setGuess} disabled={Boolean(state?.completed)}
        correct={state?.completed ? puzzle.midpoint : null} />
      {!state?.completed && <button onClick={submit} disabled={!guess}
        className="mt-3 h-12 w-full rounded-xl bg-violet font-extrabold text-white shadow-md active:scale-[.98] disabled:opacity-35 dark:bg-[#7569e5]">
        Submit pin
      </button>}
      {state?.completed && <p className="mt-3 text-center text-sm font-black text-slate-700 dark:text-white">
        {Math.round(state.distanceKm).toLocaleString()} km away · {state.score} points
      </p>}
    </div>
  );
}
