"use client";

import Image from "next/image";
import AudioPlayer from "@/components/AudioPlayer";
import { hashString } from "@/lib/dailySeed";
import type { AdminNeedleDropPreview as Preview } from "@/types/admin";
import { explainNeedleDropGuess } from "@/lib/normalize";
import { useState } from "react";

async function copyJson(value: unknown) {
  await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
}

function Datum({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="theme-raised rounded-xl border p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-1 break-words text-sm font-bold text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}

export default function AdminNeedleDropPreview({
  preview,
  date,
  onRegenerate
}: {
  preview: Preview;
  date: string;
  onRegenerate: () => void;
}) {
  const [testGuessTitle, setTestGuessTitle] = useState("");
  const [testGuessArtist, setTestGuessArtist] = useState("");
  if (preview.status === "error") {
    return (
      <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
        <h2 className="text-2xl font-black text-slate-950 dark:text-white">Rewind</h2>
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">{preview.error}</p>
      </section>
    );
  }

  const { puzzle, diagnostics } = preview;
  const guessExplanation = explainNeedleDropGuess({
    displayValue: `${testGuessTitle} — ${testGuessArtist}`,
    title: testGuessTitle,
    artist: testGuessArtist,
    selectedAutocomplete: true
  }, puzzle.title, puzzle.artist);
  return (
    <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#db4e36] dark:text-[#ff826a]">Game diagnostics</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Rewind</h2>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">Ready</span>
      </div>

      <div className="mt-5 flex gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-[#3b424f] dark:bg-[#292e38]">
          {puzzle.track.artworkUrl && <Image src={puzzle.track.artworkUrl} alt="" fill className="object-cover" sizes="96px" />}
        </div>
        <div className="min-w-0 self-center">
          <h3 className="text-xl font-black text-slate-950 dark:text-white">{puzzle.title}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{puzzle.artist}</p>
          <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">{puzzle.track.collectionName || "Album unavailable"}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Datum label="Game date" value={puzzle.puzzleDate} />
        <Datum label="Daily seed" value={hashString(`needledrop:${date}`)} />
        <Datum label="Historical year selected" value={diagnostics.historicalYearSelected} />
        <Datum label="Selected daily date" value={diagnostics.selectedDailyDate} />
        <Datum label="Target historical month/day" value={diagnostics.targetHistoricalMonthDay} />
        <Datum label="Billboard date" value={puzzle.chartDate} />
        <Datum label="Source chart issue" value={puzzle.chartSourceDate ?? "—"} />
        <Datum label="Chart position" value={`#${puzzle.chartPosition}`} />
        <Datum label="Requested historical chart date" value={diagnostics.requestedHistoricalChartDate} />
        <Datum label="Resolved Billboard issue date" value={diagnostics.resolvedBillboardIssueDate} />
        <Datum label="Issue date delta" value={`${diagnostics.chartDateDeltaDays} day(s)`} />
        <Datum label="Fallback window used" value={`±${diagnostics.fallbackWindowDays} days`} />
        <Datum label="Recognizability score" value={`${diagnostics.recognizabilityScore}/100`} />
        <Datum label="Recognizability tier" value={diagnostics.recognizabilityTier} />
        <Datum label="Why eligible" value={diagnostics.eligibilityReason} />
        <Datum label="Fallback used" value={diagnostics.fallbackUsed ? "Yes" : "No"} />
        <Datum label="Fallback reason" value={diagnostics.fallbackReason} />
        <Datum label="Preview URL" value={diagnostics.previewAvailable ? "Available" : "Missing"} />
        <Datum label="Provider" value={diagnostics.sourceProvider} />
        <Datum label="Raw iTunes title" value={diagnostics.rawITunesTitle} />
        <Datum label="Normalized correct title" value={diagnostics.normalizedCorrectTitle} />
        <Datum label="Normalized correct artist" value={diagnostics.normalizedCorrectArtist} />
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 p-4 dark:border-[#3b424f]">
        <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">Test autocomplete selection</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input
            aria-label="Raw selected guess title"
            value={testGuessTitle}
            onChange={(event) => setTestGuessTitle(event.target.value)}
            placeholder="Selected track title"
            className="h-12 rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-950 outline-none focus:border-violet dark:border-[#454c5a] dark:bg-[#252a34] dark:text-white"
          />
          <input
            aria-label="Raw selected guess artist"
            value={testGuessArtist}
            onChange={(event) => setTestGuessArtist(event.target.value)}
            placeholder="Selected artist"
            className="h-12 rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-950 outline-none focus:border-violet dark:border-[#454c5a] dark:bg-[#252a34] dark:text-white"
          />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Datum label="Raw guess title" value={guessExplanation.rawGuessTitle || "—"} />
          <Datum label="Raw guess artist" value={guessExplanation.rawGuessArtist || "—"} />
          <Datum label="Normalized guess title" value={guessExplanation.normalizedGuessTitle || "—"} />
          <Datum label="Normalized guess artist" value={guessExplanation.normalizedGuessArtist || "—"} />
          <Datum label="Normalized correct title" value={guessExplanation.normalizedCorrectTitle} />
          <Datum label="Normalized correct artist" value={guessExplanation.normalizedCorrectArtist} />
          <Datum label="Title match" value={guessExplanation.titleMatch ? "true" : "false"} />
          <Datum label="Artist match" value={guessExplanation.artistMatch ? "true" : "false"} />
          <Datum label="Final accepted" value={guessExplanation.correct ? "true" : "false"} />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Rejection reason: {guessExplanation.reason}</p>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-3 dark:border-[#343a47] dark:bg-[#20242c]">
        <AudioPlayer src={puzzle.track.previewUrl} duration={30} ended playLabel="Play Preview" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button onClick={() => copyJson(puzzle)} className="rounded-xl bg-violet px-3 py-3 text-sm font-extrabold text-white dark:bg-[#7569e5]">Copy Puzzle JSON</button>
        <button onClick={onRegenerate} className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-extrabold text-slate-700 dark:border-[#454c5a] dark:bg-[#292e38] dark:text-white">Regenerate Puzzle</button>
        <a href={puzzle.track.previewUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-center text-sm font-extrabold text-slate-700 dark:border-[#454c5a] dark:bg-[#292e38] dark:text-white">Open Preview URL</a>
      </div>

      <h3 className="mb-3 mt-6 text-xs font-black uppercase tracking-[.16em] text-slate-500 dark:text-slate-300">Diagnostics</h3>
      <div className="grid grid-cols-2 gap-2">
        <Datum label="API request" value={diagnostics.requestStatus} />
        <Datum label="Response status" value={diagnostics.responseStatus} />
        <Datum label="Match confidence" value={`${Math.round(diagnostics.matchConfidence * 100)}%`} />
        <Datum label="Attempted years" value={diagnostics.attemptedYears.join(", ")} />
        <Datum label="Attempted chart dates" value={diagnostics.attemptedChartDates.join(", ")} />
        <Datum label="Attempted positions" value={diagnostics.attemptedChartPositions.map((position) => `#${position}`).join(", ")} />
        <Datum label="Final selected song" value={diagnostics.finalSelectedSong} />
        <Datum label="Eligibility evidence" value={diagnostics.eligibilityReason} />
        <Datum label="Errors" value={diagnostics.errors.length ? diagnostics.errors.join(", ") : "None"} />
      </div>

      <details className="mt-3 rounded-xl border border-slate-200 dark:border-[#3b424f]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">Preview availability attempts</summary>
        <pre className="max-h-72 overflow-auto border-t border-slate-200 p-4 text-[11px] dark:border-[#3b424f]">{JSON.stringify(diagnostics.previewAvailability, null, 2)}</pre>
      </details>

      <details className="mt-5 rounded-xl border border-slate-200 dark:border-[#3b424f]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">Raw puzzle JSON</summary>
        <pre className="max-h-80 overflow-auto border-t border-slate-200 p-4 text-[11px] dark:border-[#3b424f]">{JSON.stringify(puzzle, null, 2)}</pre>
      </details>
      <details className="mt-2 rounded-xl border border-slate-200 dark:border-[#3b424f]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-extrabold">Raw provider/API response</summary>
        <pre className="max-h-96 overflow-auto border-t border-slate-200 p-4 text-[11px] dark:border-[#3b424f]">{JSON.stringify(preview.rawProviderResponse, null, 2)}</pre>
      </details>
      <button onClick={() => copyJson(preview.rawProviderResponse)} className="mt-2 w-full rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-extrabold text-slate-700 dark:bg-[#292e38] dark:text-white">Copy Provider JSON</button>
    </section>
  );
}
