"use client";

import Image from "next/image";
import InteractiveGuessMap from "@/components/InteractiveGuessMap";
import { formatChartDate } from "@/lib/date";
import type { MinefieldSummary } from "@/types/minefield";

export default function DailyAnswerReview({
  summary,
  onClose
}: {
  summary: MinefieldSummary;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/55 backdrop-blur-sm sm:items-center sm:justify-center sm:p-5">
      <section className="theme-surface max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[1.75rem] border px-5 pb-5 pt-3 sm:rounded-[1.75rem]">
        <div className="sticky top-0 z-20 flex items-start justify-between bg-[var(--surface)] pb-4 pt-2">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#db4e36] dark:text-[#ff826a]">Board complete</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Daily Answers</h2>
          </div>
          <button onClick={onClose} aria-label="Close answer review" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-2xl font-bold leading-none dark:bg-[#292e38]">×</button>
        </div>

        <div className="space-y-3">
          {summary.results.map((result) => {
            const review = result.reviewData;
            return (
              <article key={result.gameId} className="theme-raised rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-black text-slate-950 dark:text-white">{result.icon} {result.displayName}</h3>
                  <span className="font-black text-violet dark:text-[#9187f6]">{result.score}/{result.maxScore}</span>
                </div>

                {review.type === "needledrop" && (
                  <div className="mt-3 flex gap-3">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-[#292e38]">
                      {review.artworkUrl && <Image src={review.artworkUrl} alt="" fill sizes="80px" className="object-cover" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-slate-950 dark:text-white">{review.songTitle}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">{review.artist}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        #{review.chartPosition} · {formatChartDate(review.chartDate)}
                      </p>
                      <p className="mt-1 text-xs font-bold">{result.summaryLabel}</p>
                    </div>
                  </div>
                )}

                {review.type === "top-three" && (
                  <div className="mt-3">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{review.prompt}</p>
                    <ol className="mt-2 space-y-1.5">
                      {review.answers.map((answer, index) => {
                        const found = review.found.includes(answer);
                        return (
                          <li key={answer} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${found ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-[#292e38] dark:text-slate-300"}`}>
                            <span>{index + 1}.</span><span>{answer}</span><span className="ml-auto">{found ? "Found" : "Missed"}</span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}

                {review.type === "spelldrop" && (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-slate-100 p-3 dark:bg-[#292e38]">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Your spelling</p>
                      <p className="mt-1 font-black">{review.userSpelling || "No answer"}</p>
                    </div>
                    <div className="rounded-xl bg-slate-100 p-3 dark:bg-[#292e38]">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Correct word</p>
                      <p className="mt-1 font-black">{review.correctWord}</p>
                    </div>
                  </div>
                )}

                {review.type === "minefield" && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                      {review.hitMine ? "Hit a mine" : "Banked safely"} · {review.safePicks.length} safe picks
                    </p>
                    <p className="mt-1 text-xs italic text-slate-500 dark:text-slate-400">{review.clue}</p>
                    <div className="mx-auto mt-3 grid max-w-[250px] grid-cols-5 gap-1.5">
                      {Array.from({ length: 25 }, (_, index) => {
                        const mine = review.minePositions.includes(index);
                        const picked = review.safePicks.includes(index);
                        const pathIndex = review.path.indexOf(index);
                        return (
                          <div
                            key={index}
                            className={`grid aspect-square place-items-center rounded-md text-xs font-black ${
                              mine
                                ? "bg-red-500 text-white"
                                : picked
                                  ? "bg-emerald-500 text-white"
                                  : "bg-slate-200 text-slate-500 dark:bg-[#343a47] dark:text-slate-400"
                            }`}
                          >
                            {mine ? "💣" : picked ? pathIndex + 1 : ""}
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-center text-[11px] text-slate-500">Mine positions: {review.minePositions.map((value) => value + 1).join(", ")}</p>
                  </div>
                )}

                {review.type === "closer" && (
                  <div className="mt-3 text-sm">
                    <p className="font-bold text-slate-800 dark:text-slate-100">{review.prompt}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-slate-100 p-3 dark:bg-[#292e38]">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Your guess</p>
                        <p className="mt-1 font-black">{review.rawGuess}</p>
                      </div>
                      <div className="rounded-xl bg-slate-100 p-3 dark:bg-[#292e38]">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Actual answer</p>
                        <p className="mt-1 font-black">{review.displayAnswer}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {review.scoreLabel} · {(review.percentError * 100).toFixed(1)}% error
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Source: {review.sourceNote}</p>
                  </div>
                )}

                {review.type === "meet-me-halfway" && (
                  <div className="mt-3">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {review.locationA.name} ↔ {review.locationB.name}
                    </p>
                    <div className="mt-2">
                      <InteractiveGuessMap guess={review.guess} correct={review.midpoint} disabled />
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-500">
                      Your pin was {Math.round(review.distanceKm).toLocaleString()} km from the true spherical midpoint.
                    </p>
                  </div>
                )}

                {review.type === "landmark-drop" && (
                  <div className="mt-3">
                    <p className="font-black text-slate-950 dark:text-white">{review.landmark}</p>
                    <p className="text-xs text-slate-500">{review.city}, {review.country}</p>
                    <div className="mt-2">
                      <InteractiveGuessMap guess={review.guess} correct={review.correct} disabled />
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-500">
                      Your pin was {Math.round(review.distanceKm).toLocaleString()} km away.
                    </p>
                  </div>
                )}

                {review.type === "legacy" && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{review.message}</p>}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
