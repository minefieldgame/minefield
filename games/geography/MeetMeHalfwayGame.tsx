"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import InteractiveGuessMap, { type MapPoint } from "@/components/InteractiveGuessMap";
import { calculateMeetMeHalfwayScore, geographyScoreLabel, haversineDistanceKm } from "@/games/geography/logic";
import { resolveMeetMeHalfwayPuzzle } from "@/games/geography/puzzles";
import { getDailyGameDate } from "@/lib/date";
import type { MinefieldGameResult } from "@/types/minefield";

type State = { guess: MapPoint; distanceKm: number; score: number; completed: boolean };
const PREFIX = "minefield:meet-me-halfway:v1:";

export default function MeetMeHalfwayGame({
  onComplete,
  date: selectedDate,
  storageScope
}: {
  onComplete: (result: MinefieldGameResult) => void;
  date?: string;
  storageScope?: string;
}) {
  const date = selectedDate ?? getDailyGameDate();
  const storageKey = storageScope ? `${PREFIX}${storageScope}:${date}` : `${PREFIX}${date}`;
  const puzzle = useMemo(() => resolveMeetMeHalfwayPuzzle(date), [date]);
  const [guess, setGuess] = useState<MapPoint | null>(null);
  const [state, setState] = useState<State | null>(null);

  const report = useCallback((next: State) => {
    const label = geographyScoreLabel(next.score);
    onComplete({
      gameId: "meet-me-halfway", displayName: "Meet Me Halfway", icon: "🌍",
      score: next.score, maxScore: 100, completed: true, successUnits: next.score >= 65 ? 1 : 0,
      totalUnits: 1, summaryLabel: `${label} · ${Math.round(next.distanceKm).toLocaleString()} km`,
      shareLine: `🌍 Meet Me Halfway: ${next.score}/100, ${label.toLowerCase()}`,
      reviewData: {
        type: "meet-me-halfway", locationA: puzzle.locationA, locationB: puzzle.locationB,
        midpoint: puzzle.midpoint, guess: next.guess, distanceKm: next.distanceKm
      }
    });
  }, [onComplete, puzzle]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as State;
      setState(parsed); setGuess(parsed.guess);
      if (parsed.completed) report(parsed);
    } catch {}
  }, [date, report, storageKey]);

  function submit() {
    if (!guess || state?.completed) return;
    const distanceKm = haversineDistanceKm(guess, puzzle.midpoint);
    const next = { guess, distanceKm, score: calculateMeetMeHalfwayScore(distanceKm), completed: true };
    localStorage.setItem(storageKey, JSON.stringify(next));
    setState(next); report(next);
  }

  return (
    <div>
      <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <div className="rounded-xl bg-slate-100 px-2 py-2 dark:bg-[#292e38]">
          <p className="text-sm font-black text-slate-950 dark:text-white">{puzzle.locationA.name}</p>
          <p className="text-[10px] font-bold text-slate-500">{puzzle.locationA.country}</p>
        </div>
        <span className="text-lg font-black text-violet">↔</span>
        <div className="rounded-xl bg-slate-100 px-2 py-2 dark:bg-[#292e38]">
          <p className="text-sm font-black text-slate-950 dark:text-white">{puzzle.locationB.name}</p>
          <p className="text-[10px] font-bold text-slate-500">{puzzle.locationB.country}</p>
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
