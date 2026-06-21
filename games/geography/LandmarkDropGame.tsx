"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import InteractiveGuessMap, { type MapPoint } from "@/components/InteractiveGuessMap";
import { calculateLandmarkDropScore, geographyScoreLabel, haversineDistanceKm } from "@/games/geography/logic";
import { resolveLandmarkDropPuzzle } from "@/games/geography/puzzles";
import { getGameCacheKey, getPacificDateKey } from "@/lib/date";
import type { MinefieldGameResult } from "@/types/minefield";

type State = { dateKey: string; guess: MapPoint; distanceKm: number; score: number; completed: boolean };
export default function LandmarkDropGame({
  onComplete,
  date: selectedDate,
  storageScope
}: {
  onComplete: (result: MinefieldGameResult) => void;
  date?: string;
  storageScope?: string;
}) {
  const date = selectedDate ?? getPacificDateKey();
  const storageKey = getGameCacheKey("landmark-drop", date, storageScope);
  const puzzle = useMemo(() => resolveLandmarkDropPuzzle(date), [date]);
  const [guess, setGuess] = useState<MapPoint | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const target = { latitude: puzzle.landmark.latitude, longitude: puzzle.landmark.longitude };

  const report = useCallback((next: State) => {
    const label = geographyScoreLabel(next.score);
    onComplete({
      gameId: "landmark-drop", displayName: "Landmark Drop", icon: "🗼",
      score: next.score, maxScore: 100, completed: true, successUnits: next.score >= 65 ? 1 : 0,
      totalUnits: 1, summaryLabel: `${label} · ${Math.round(next.distanceKm).toLocaleString()} km`,
      shareLine: `🗼 Landmark Drop: ${next.score}/100, ${label.toLowerCase()}`,
      reviewData: {
        type: "landmark-drop", landmark: puzzle.landmark.name, city: puzzle.landmark.city,
        country: puzzle.landmark.country, correct: target, guess: next.guess,
        distanceKm: next.distanceKm, imageUrl: puzzle.landmark.imageUrl
      }
    });
  }, [onComplete, puzzle.landmark, target.latitude, target.longitude]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as State;
      if (parsed.dateKey !== date) {
        localStorage.removeItem(storageKey);
        return;
      }
      setState(parsed); setGuess(parsed.guess);
      if (parsed.completed) report(parsed);
    } catch {}
  }, [date, report, storageKey]);

  function submit() {
    if (!guess || state?.completed) return;
    const distanceKm = haversineDistanceKm(guess, target);
    const next = { dateKey: date, guess, distanceKm, score: calculateLandmarkDropScore(distanceKm), completed: true };
    localStorage.setItem(storageKey, JSON.stringify(next));
    setState(next); report(next);
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-[#292e38]">
          {!imageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={puzzle.landmark.imageUrl} alt={puzzle.landmark.imageAlt}
              onError={() => setImageFailed(true)} className="h-full w-full object-cover" />
          ) : <div className="grid h-full place-items-center text-3xl" aria-label="Landmark image unavailable">🗺️</div>}
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-coral">Today’s landmark</p>
          <h3 className="mt-1 text-xl font-black leading-tight text-slate-950 dark:text-white">{puzzle.landmark.name}</h3>
        </div>
      </div>
      <InteractiveGuessMap guess={guess} onGuess={setGuess} disabled={Boolean(state?.completed)}
        correct={state?.completed ? target : null} />
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
