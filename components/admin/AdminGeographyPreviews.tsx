"use client";

import { useState } from "react";
import InteractiveGuessMap, { type MapPoint } from "@/components/InteractiveGuessMap";
import type { AdminLandmarkDropPreview, AdminMeetMeHalfwayPreview } from "@/types/admin";
import { calculateLandmarkDropScore, calculateMeetMeHalfwayScore } from "@/games/geography/logic";

export function AdminMeetMeHalfwayPreview({ preview }: { preview: AdminMeetMeHalfwayPreview }) {
  const { puzzle } = preview;
  const [guess, setGuess] = useState<MapPoint | null>(null);
  const diagnostics = guess ? calculateMeetMeHalfwayScore(guess, puzzle.finalGameplayMidpoint ?? puzzle.midpoint) : null;
  return (
    <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
      <h2 className="text-2xl font-black">Meet Me Halfway</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {[
          ["Location A", `${puzzle.locationA.name}, ${puzzle.locationA.country}`],
          ["Location A coordinates", `${puzzle.locationA.latitude}, ${puzzle.locationA.longitude}`],
          ["Location B", `${puzzle.locationB.name}, ${puzzle.locationB.country}`],
          ["Location B coordinates", `${puzzle.locationB.latitude}, ${puzzle.locationB.longitude}`],
          ["Spherical midpoint", `${puzzle.sphericalMidpoint.latitude.toFixed(4)}, ${puzzle.sphericalMidpoint.longitude.toFixed(4)}`],
          ["Projected midpoint", `${puzzle.projectedMidpoint.latitude.toFixed(4)}, ${puzzle.projectedMidpoint.longitude.toFixed(4)}`],
          ["Final gameplay midpoint", `${(puzzle.finalGameplayMidpoint ?? puzzle.midpoint).latitude.toFixed(4)}, ${(puzzle.finalGameplayMidpoint ?? puzzle.midpoint).longitude.toFixed(4)}`],
          ["Seed", puzzle.seed]
        ].map(([label, value]) => <div key={label} className="theme-raised rounded-xl border p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>)}
      </div>
      <div className="mt-4"><InteractiveGuessMap guess={guess} onGuess={setGuess} correct={puzzle.finalGameplayMidpoint ?? puzzle.midpoint} /></div>
      {diagnostics && <GeoDiagnostics diagnostics={diagnostics} />}
      <details className="mt-3 rounded-xl border"><summary className="cursor-pointer px-4 py-3 font-extrabold">Raw JSON</summary><pre className="max-h-80 overflow-auto border-t p-4 text-[11px]">{JSON.stringify(puzzle, null, 2)}</pre></details>
    </section>
  );
}

export function AdminLandmarkDropPreview({ preview }: { preview: AdminLandmarkDropPreview }) {
  const { puzzle } = preview;
  const [imageStatus, setImageStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const [guess, setGuess] = useState<MapPoint | null>(null);
  const target = { latitude: puzzle.landmark.latitude, longitude: puzzle.landmark.longitude };
  const diagnostics = guess ? calculateLandmarkDropScore(guess, target, puzzle.landmark.country, puzzle.landmark.city) : null;
  return (
    <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
      <h2 className="text-2xl font-black">On a Postcard</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {[
          ["Landmark", puzzle.landmark.name], ["Location", `${puzzle.landmark.city}, ${puzzle.landmark.country}`],
          ["Coordinates", `${puzzle.landmark.latitude}, ${puzzle.landmark.longitude}`],
          ["Image URL", puzzle.landmark.imageUrl],
          ["Source", puzzle.landmark.sourceNote],
          ["Validation", puzzle.landmark.imageValidation ?? "photograph candidate"],
          ["Image status", imageStatus],
          ["Seed", puzzle.seed]
        ].map(([label, value]) => <div key={label} className="theme-raised rounded-xl border p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 break-all text-sm font-bold">{value}</p></div>)}
      </div>
      <div className="theme-raised mt-4 overflow-hidden rounded-2xl border">
        {imageStatus !== "failed" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={puzzle.landmark.imageUrl}
            alt={puzzle.landmark.imageAlt}
            onLoad={() => setImageStatus("loaded")}
            onError={() => setImageStatus("failed")}
            className="h-52 w-full object-cover"
          />
        ) : (
          <div className="grid h-52 place-items-center p-5 text-center">
            <p className="font-black text-red-600 dark:text-red-300">Image failed to load for {puzzle.landmark.name}</p>
          </div>
        )}
      </div>
      <div className="mt-4"><InteractiveGuessMap guess={guess} onGuess={setGuess} correct={target} /></div>
      {diagnostics && <GeoDiagnostics diagnostics={diagnostics} />}
      <details className="mt-3 rounded-xl border"><summary className="cursor-pointer px-4 py-3 font-extrabold">Raw JSON</summary><pre className="max-h-80 overflow-auto border-t p-4 text-[11px]">{JSON.stringify(puzzle, null, 2)}</pre></details>
    </section>
  );
}

function GeoDiagnostics({ diagnostics }: { diagnostics: ReturnType<typeof calculateMeetMeHalfwayScore> }) {
  return (
    <div className="theme-raised mt-3 grid grid-cols-2 gap-2 rounded-2xl border p-3 sm:grid-cols-4">
      {[
        ["Distance", `${Math.round(diagnostics.distanceKm)} km`],
        ["Base score", diagnostics.baseScore],
        ["Continent bonus", diagnostics.continentBonus],
        ["Country bonus", diagnostics.countryBonus],
        ["Region bonus", diagnostics.regionBonus],
        ["Metro bonus", diagnostics.metroBonus],
        ["Guessed country", diagnostics.guessedCountry],
        ["Final score", `${diagnostics.finalScore} · ${diagnostics.label}`]
      ].map(([label, value]) => <div key={label}><p className="text-[9px] font-black uppercase text-slate-500">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>)}
    </div>
  );
}
