"use client";

import InteractiveGuessMap from "@/components/InteractiveGuessMap";
import type { AdminLandmarkDropPreview, AdminMeetMeHalfwayPreview } from "@/types/admin";

export function AdminMeetMeHalfwayPreview({ preview }: { preview: AdminMeetMeHalfwayPreview }) {
  const { puzzle } = preview;
  return (
    <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
      <h2 className="text-2xl font-black">Meet Me Halfway</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {[
          ["Location A", `${puzzle.locationA.name}, ${puzzle.locationA.country}`],
          ["Location A coordinates", `${puzzle.locationA.latitude}, ${puzzle.locationA.longitude}`],
          ["Location B", `${puzzle.locationB.name}, ${puzzle.locationB.country}`],
          ["Location B coordinates", `${puzzle.locationB.latitude}, ${puzzle.locationB.longitude}`],
          ["Spherical midpoint", `${puzzle.midpoint.latitude.toFixed(4)}, ${puzzle.midpoint.longitude.toFixed(4)}`],
          ["Seed", puzzle.seed]
        ].map(([label, value]) => <div key={label} className="theme-raised rounded-xl border p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>)}
      </div>
      <div className="mt-4"><InteractiveGuessMap guess={null} correct={puzzle.midpoint} disabled /></div>
      <details className="mt-3 rounded-xl border"><summary className="cursor-pointer px-4 py-3 font-extrabold">Raw JSON</summary><pre className="max-h-80 overflow-auto border-t p-4 text-[11px]">{JSON.stringify(puzzle, null, 2)}</pre></details>
    </section>
  );
}

export function AdminLandmarkDropPreview({ preview }: { preview: AdminLandmarkDropPreview }) {
  const { puzzle } = preview;
  return (
    <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
      <h2 className="text-2xl font-black">Landmark Drop</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {[
          ["Landmark", puzzle.landmark.name], ["Location", `${puzzle.landmark.city}, ${puzzle.landmark.country}`],
          ["Coordinates", `${puzzle.landmark.latitude}, ${puzzle.landmark.longitude}`],
          ["Image URL", puzzle.landmark.imageUrl], ["Image status", preview.imageStatus], ["Seed", puzzle.seed]
        ].map(([label, value]) => <div key={label} className="theme-raised rounded-xl border p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 break-all text-sm font-bold">{value}</p></div>)}
      </div>
      <div className="mt-4"><InteractiveGuessMap guess={null} correct={{ latitude: puzzle.landmark.latitude, longitude: puzzle.landmark.longitude }} disabled /></div>
      <details className="mt-3 rounded-xl border"><summary className="cursor-pointer px-4 py-3 font-extrabold">Raw JSON</summary><pre className="max-h-80 overflow-auto border-t p-4 text-[11px]">{JSON.stringify(puzzle, null, 2)}</pre></details>
    </section>
  );
}
