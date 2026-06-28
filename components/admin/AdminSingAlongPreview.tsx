"use client";

import type { AdminSingAlongPreview } from "@/types/admin";

export default function AdminSingAlongPreview({ preview }: { preview: AdminSingAlongPreview }) {
  if (preview.status === "error") {
    return (
      <section className="theme-surface rounded-[2rem] border border-red-200 p-5 sm:p-6 dark:border-red-400/20">
        <h2 className="text-2xl font-black">Sing Along</h2>
        <p className="mt-2 text-sm font-bold text-red-600 dark:text-red-300">{preview.error}</p>
      </section>
    );
  }

  const { puzzle, diagnostics } = preview;
  return (
    <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
      <h2 className="text-2xl font-black">Sing Along</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Song", `${puzzle.title} — ${puzzle.artist}`],
          ["Chart date", diagnostics.chartDate],
          ["Chart position", `#${puzzle.chartPosition}`],
          ["Playback start", `${diagnostics.playbackStart}s`],
          ["Playback stop", `${diagnostics.playbackStop}s`],
          ["Chorus timestamp", `${diagnostics.chorusTimestamp}s`],
          ["Accepted lyric", diagnostics.acceptedLyric],
          ["Alternate spellings", diagnostics.alternateAcceptedLyrics.join(", ")],
          ["Cache key", diagnostics.cacheKey],
          ["Content hash", diagnostics.contentHash],
          ["Generated", diagnostics.generatedAt],
          ["Source", diagnostics.sourceProvider]
        ].map(([label, value]) => (
          <div key={label} className="theme-raised min-w-0 rounded-xl border p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 break-words text-sm font-bold">{value}</p>
          </div>
        ))}
      </div>
      <details className="mt-3 rounded-xl border">
        <summary className="cursor-pointer px-4 py-3 font-extrabold">Raw JSON</summary>
        <pre className="max-h-80 overflow-auto border-t p-4 text-[11px]">{JSON.stringify(puzzle, null, 2)}</pre>
      </details>
    </section>
  );
}
