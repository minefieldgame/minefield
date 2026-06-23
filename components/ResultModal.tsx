"use client";

import Image from "next/image";
import AudioPlayer from "@/components/AudioPlayer";
import ShareButton from "@/components/ShareButton";
import { formatChartDate } from "@/lib/date";
import type { GameState } from "@/types/game";

export default function ResultModal({ state, onClose }: { state: GameState; onClose: () => void }) {
  const { puzzle } = state;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end overflow-x-hidden bg-slate-950/50 p-0 backdrop-blur-md dark:bg-black/70 sm:place-items-center sm:p-5">
      <section className="theme-surface max-h-[calc(100dvh-env(safe-area-inset-top))] w-full min-w-0 max-w-md overflow-x-hidden overflow-y-auto rounded-t-[1.5rem] border p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:max-h-[94vh] sm:rounded-[2rem] sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-[#db4e36] dark:text-[#ff826a]">
              {state.status === "won" ? "You got it!" : "Today’s answer"}
            </p>
            <h2 className="mt-1 break-words text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">Score {state.score}</h2>
          </div>
          <button aria-label="Close result" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-slate-100 text-xl text-slate-700 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet/20 active:scale-90 dark:border-[#444b59] dark:bg-[#292e38] dark:text-white dark:hover:bg-[#353b47]">×</button>
        </div>
        <div className="mt-4 flex min-w-0 gap-3 sm:mt-5 sm:gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-md sm:h-28 sm:w-28 sm:rounded-2xl dark:border-[#3c4350] dark:bg-[#292e38]">
            {puzzle.track.artworkUrl && (
              <Image src={puzzle.track.artworkUrl} alt="" fill priority className="object-cover" sizes="112px" />
            )}
          </div>
          <div className="min-w-0 self-center">
            <h3 className="break-words text-lg font-black leading-tight text-slate-950 dark:text-white sm:text-xl">{puzzle.title}</h3>
            <p className="mt-1 break-words text-sm text-slate-600 dark:text-slate-300 sm:text-base">{puzzle.artist}</p>
            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              No. {puzzle.chartPosition} · {formatChartDate(puzzle.chartDate)}
            </p>
          </div>
        </div>
        <AudioPlayer src={puzzle.track.previewUrl} duration={30} ended />
        <div className="space-y-3">
          <ShareButton state={state} />
          {puzzle.track.trackViewUrl && (
            <a
              href={puzzle.track.trackViewUrl}
              target="_blank"
              rel="noreferrer"
              className="block w-full rounded-2xl bg-[#202128] px-5 py-3.5 text-center font-extrabold text-white shadow-md hover:bg-[#30323a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-400/30 active:scale-[.98] dark:border dark:border-[#444b59] dark:bg-[#292e38] dark:hover:bg-[#353b47]"
            >
              Listen / Buy on Apple Music
            </a>
          )}
        </div>
        <p className="mt-4 text-center text-[11px] text-slate-500 dark:text-slate-400">
          Audio preview provided by iTunes.
        </p>
      </section>
    </div>
  );
}
