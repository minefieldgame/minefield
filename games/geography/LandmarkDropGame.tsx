"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ErrorState from "@/components/ErrorState";
import InteractiveGuessMap, { type MapPoint } from "@/components/InteractiveGuessMap";
import LoadingState from "@/components/LoadingState";
import { calculateLandmarkDropScore, type GeographyScoreResult } from "@/games/geography/logic";
import { getGameCacheKey, getPacificDateKey } from "@/lib/date";
import type { MinefieldGameResult } from "@/types/minefield";

type State = { dateKey: string; guess: MapPoint; distanceKm: number; score: number; completed: boolean; diagnostics: GeographyScoreResult };
type LandmarkPuzzle = {
  landmark: {
    name: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
    imageUrl: string;
    imageAlt: string;
  };
};

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
  const [puzzle, setPuzzle] = useState<LandmarkPuzzle | null>(null);
  const [loadingPuzzle, setLoadingPuzzle] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [guess, setGuess] = useState<MapPoint | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const target = useMemo(() => puzzle ? { latitude: puzzle.landmark.latitude, longitude: puzzle.landmark.longitude } : null, [puzzle]);

  const report = useCallback((next: State) => {
    if (!puzzle || !target) return;
    const label = next.diagnostics.label;
    onComplete({
      gameId: "landmark-drop", displayName: "On a Postcard", icon: "🗼",
      score: next.score, maxScore: 100, completed: true, successUnits: next.score >= 65 ? 1 : 0,
      totalUnits: 1, summaryLabel: `${label} · ${Math.round(next.distanceKm).toLocaleString()} km`,
      shareLine: `🗼 On a Postcard: ${next.score}/100, ${label.toLowerCase()}`,
      reviewData: {
        type: "landmark-drop", landmark: puzzle.landmark.name, city: puzzle.landmark.city,
        country: puzzle.landmark.country, correct: target, guess: next.guess,
        distanceKm: next.distanceKm, imageUrl: puzzle.landmark.imageUrl,
        scoringDiagnostics: next.diagnostics
      }
    });
  }, [onComplete, puzzle, target]);

  const loadPuzzle = useCallback(async () => {
    setLoadingPuzzle(true);
    setLoadError("");
    setImageFailed(false);
    try {
      const response = await fetch(`/api/landmark-drop?date=${date}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Today’s On a Postcard puzzle could not be loaded.");
      setPuzzle(payload as LandmarkPuzzle);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Today’s On a Postcard puzzle could not be loaded.");
    } finally {
      setLoadingPuzzle(false);
    }
  }, [date]);

  useEffect(() => {
    loadPuzzle();
  }, [loadPuzzle]);

  useEffect(() => {
    if (!puzzle || !target) return;
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
        diagnostics: calculateLandmarkDropScore(parsed.guess, target, puzzle.landmark.country, puzzle.landmark.city)
      };
      setState(restored);
      setGuess(restored.guess);
      if (restored.completed) report(restored);
    } catch {}
  }, [date, puzzle, report, storageKey, target]);

  function submit() {
    if (!guess || state?.completed || !puzzle || !target) return;
    const diagnostics = calculateLandmarkDropScore(guess, target, puzzle.landmark.country, puzzle.landmark.city);
    const next = { dateKey: date, guess, distanceKm: diagnostics.distanceKm, score: diagnostics.finalScore, completed: true, diagnostics };
    localStorage.setItem(storageKey, JSON.stringify(next));
    setState(next);
    report(next);
  }

  if (loadingPuzzle) return <LoadingState />;
  if (loadError || !puzzle || !target) return <ErrorState message={loadError || "Today’s On a Postcard puzzle could not be loaded."} retry={loadPuzzle} />;

  return (
    <div className="min-w-0">
      <div className="mb-3 min-w-0">
        <div className="relative h-[clamp(84px,16dvh,120px)] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm landscape:h-[clamp(72px,22dvh,100px)] dark:border-white/10 dark:bg-[#292e38]">
          {!imageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={puzzle.landmark.imageUrl} alt={puzzle.landmark.imageAlt}
              onError={() => setImageFailed(true)} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center bg-gradient-to-br from-violet/10 to-coral/10 p-3 text-center" role="img" aria-label={`${puzzle.landmark.name} image unavailable`}>
              <div>
                <span className="text-2xl" aria-hidden="true">🗺️</span>
                <p className="mt-1 text-[10px] font-black leading-tight text-slate-700 dark:text-slate-200">{puzzle.landmark.name}</p>
              </div>
            </div>
          )}
        </div>
        <div className="mt-2 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[.14em] text-coral sm:text-[10px]">Today’s landmark</p>
          <h3 className="mt-0.5 break-words text-lg font-black leading-tight text-slate-950 dark:text-white sm:text-xl">{puzzle.landmark.name}</h3>
        </div>
      </div>
      <InteractiveGuessMap guess={guess} onGuess={setGuess} disabled={Boolean(state?.completed)}
        correct={state?.completed ? target : null} />
      {!state?.completed && <button onClick={submit} disabled={!guess}
        className="mt-3 h-12 w-full rounded-xl bg-violet font-extrabold text-white shadow-md active:scale-[.98] disabled:opacity-35 dark:bg-[#7569e5]">
        Submit pin
      </button>}
      {state?.completed && <p className="mt-2 break-words text-center text-sm font-black text-slate-700 dark:text-white">
        {Math.round(state.distanceKm).toLocaleString()} km away · {state.score} points
      </p>}
    </div>
  );
}
