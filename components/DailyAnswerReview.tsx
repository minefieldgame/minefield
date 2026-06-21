"use client";

import Image from "next/image";
import InteractiveGuessMap from "@/components/InteractiveGuessMap";
import { formatChartDate } from "@/lib/date";
import type { MinefieldSummary } from "@/types/minefield";

function unavailableMessage(message: string) {
  return /error|generate|unavailable|failed/i.test(message)
    ? "Today’s puzzle was unavailable."
    : message;
}

export default function DailyAnswerReview({ summary }: { summary: MinefieldSummary }) {
  return (
    <div className="space-y-3">
      {summary.results.map((result) => {
        const review = result.reviewData;
        return (
          <article key={result.gameId} className="theme-surface rounded-2xl border p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-black text-slate-950 dark:text-white">
                {result.icon} {result.displayName}
              </h2>
              <span className="font-black text-violet dark:text-[#9187f6]">
                {result.score}/{result.maxScore}
              </span>
            </div>

            {review.type === "needledrop" && (
              <div className="mt-3 flex gap-3">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-[#292e38]">
                  {review.artworkUrl && (
                    <Image src={review.artworkUrl} alt="" fill sizes="80px" className="object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-slate-950 dark:text-white">{review.songTitle}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{review.artist}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    #{review.chartPosition} · {formatChartDate(review.chartDate)}
                  </p>
                </div>
              </div>
            )}

            {review.type === "ranked-top-10" && (
              <div className="mt-3">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{review.prompt}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Your final order</p>
                    <ol className="mt-1.5 space-y-1">
                      {review.userOrder.map((answer, index) => {
                        const correct = review.correctOrder[index] === answer;
                        return (
                          <li key={`${answer}-${index}`} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                            correct
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "bg-red-500/10 text-red-700 dark:text-red-300"
                          }`}>
                            <span>{index + 1}.</span><span className="truncate">{answer}</span>
                            <span className="ml-auto">{correct ? "✓" : "×"}</span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Correct order</p>
                    <ol className="mt-1.5 space-y-1">
                      {review.correctOrder.map((answer, index) => (
                        <li key={answer} className="flex items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:bg-[#292e38] dark:text-slate-200">
                          <span>{index + 1}.</span><span className="truncate">{answer}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {review.correctPositions.length}/10 correctly placed · {review.attemptsUsed} attempts used
                </p>
              </div>
            )}

            {review.type === "spelldrop" && (
              <div className="mt-3">
                {review.definition && <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">{review.definition}</p>}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <ReviewValue label="Your spelling" value={review.userSpelling || "No answer"} />
                  <ReviewValue label="Correct word" value={review.correctWord} />
                </div>
              </div>
            )}

            {review.type === "minefield" && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                  {review.hitMine ? "Hit a mine" : "Minefield cleared"} · {review.difficulty} difficulty · {review.runScore}/{review.runMaxScore} earned
                </p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {review.mineCount} mines · {review.safePicks.length}/{review.maxPicks} safe picks
                </p>
                <div className="mx-auto mt-3 grid max-w-[260px] grid-cols-4 gap-2">
                  {Array.from({ length: 16 }, (_, index) => {
                    const mine = review.minePositions.includes(index);
                    const picked = review.safePicks.includes(index);
                    return (
                      <div key={index} className={`grid aspect-square place-items-center rounded-md text-xs font-black ${
                        mine ? "bg-red-500 text-white" : picked
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-200 text-slate-500 dark:bg-[#343a47] dark:text-slate-400"
                      }`}>
                        {mine ? "💣" : picked ? review.path.indexOf(index) + 1 : ""}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {review.type === "closer" && (
              <div className="mt-3 text-sm">
                <p className="font-bold text-slate-800 dark:text-slate-100">{review.prompt}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <ReviewValue label="Your guess" value={review.rawGuess} />
                  <ReviewValue label="Actual answer" value={review.displayAnswer} />
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
                  Your pin was {Math.round(review.distanceKm).toLocaleString()} km from the true midpoint.
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

            {review.type === "legacy" && (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                {unavailableMessage(review.message)}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ReviewValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-100 p-3 dark:bg-[#292e38]">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 break-words font-black">{value}</p>
    </div>
  );
}
