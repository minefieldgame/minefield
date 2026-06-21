"use client";

import { useCallback, useEffect, useState } from "react";
import AttemptTracker from "@/components/AttemptTracker";
import AudioPlayer from "@/components/AudioPlayer";
import ErrorState from "@/components/ErrorState";
import GuessInput from "@/components/GuessInput";
import Header from "@/components/Header";
import LoadingState from "@/components/LoadingState";
import ResultModal from "@/components/ResultModal";
import StatsModal from "@/components/StatsModal";
import { formatChartDate, getPacificDateKey } from "@/lib/date";
import { isCorrectGuess } from "@/lib/normalize";
import { scoreForAttempt, SNIPPET_LENGTHS } from "@/lib/scoring";
import {
  EMPTY_STATS,
  loadArchive,
  loadGame,
  loadStats,
  saveArchive,
  saveGame,
  saveStats
} from "@/lib/storage";
import type { DailyPuzzle, GameState, SongGuessSubmission } from "@/types/game";
import type { MinefieldGameResult } from "@/types/minefield";

type Props = {
  embedded?: boolean;
  onComplete?: (result: MinefieldGameResult) => void;
  date?: string;
  storageScope?: string;
};

export default function GameShell({ embedded = false, onComplete, date, storageScope }: Props) {
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showStats, setShowStats] = useState(false);

  function chartContext(puzzle: DailyPuzzle) {
    const currentYear = Number(puzzle.puzzleDate.slice(0, 4));
    const yearsAgo = Math.max(0, currentYear - puzzle.chartYear);
    const chartIssueDate = puzzle.chartSourceDate ?? puzzle.chartDate;
    return `Today’s track was #${puzzle.chartPosition} on the Billboard Hot 100 chart dated ${formatChartDate(chartIssueDate)}${yearsAgo ? ` — ${yearsAgo} years ago` : ""}.`;
  }

  const loadPuzzle = useCallback(async () => {
    setLoading(true);
    setError("");
    const dateKey = date ?? getPacificDateKey();
    const stored = loadGame(dateKey, storageScope);
    if (stored?.puzzle.puzzleDate === dateKey) {
      setState(stored);
      setShowResult(!embedded && stored.status !== "playing");
      if (stored.status !== "playing") {
        const won = stored.status === "won";
        const solvedIn = stored.attempt + 1;
        const summaryLabel = won ? `Solved in ${solvedIn}` : "Not solved";
        onComplete?.({
          gameId: "needledrop",
          displayName: "NeedleDrop",
          icon: "🎵",
          score: stored.score,
          maxScore: 100,
          completed: true,
          successUnits: won ? solvedIn : 0,
          totalUnits: 7,
          summaryLabel,
          shareLine: `🎵 NeedleDrop: ${stored.score}/100, ${summaryLabel.toLowerCase()}`,
          reviewData: {
            type: "needledrop",
            songTitle: stored.puzzle.title,
            artist: stored.puzzle.artist,
            chartDate: stored.puzzle.chartDate,
            chartPosition: stored.puzzle.chartPosition,
            artworkUrl: stored.puzzle.track.artworkUrl,
            userGuesses: stored.guesses,
            won
          },
          detail: summaryLabel
        });
      }
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`/api/daily?date=${dateKey}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      const next: GameState = {
        puzzle: payload as DailyPuzzle,
        attempt: 0,
        guesses: [],
        status: "playing",
        score: 0,
        updatedAt: new Date().toISOString()
      };
      saveGame(next, storageScope);
      setState(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Today’s song could not be loaded. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [date, embedded, onComplete, storageScope]);

  useEffect(() => {
    loadPuzzle();
  }, [loadPuzzle]);

  function persist(next: GameState) {
    saveGame(next, storageScope);
    setState(next);
  }

  function finish(next: GameState) {
    persist(next);
    const won = next.status === "won";
    if (!storageScope) {
      const stats = { ...EMPTY_STATS, ...loadStats() };
      stats.gamesPlayed += 1;
      stats.wins += won ? 1 : 0;
      stats.totalScore += next.score;
      stats.currentStreak = won ? stats.currentStreak + 1 : 0;
      stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
      stats.perfectGuesses += won && next.attempt === 0 ? 1 : 0;
      if (won) {
        const key = String(next.attempt + 1);
        stats.guessDistribution[key] = (stats.guessDistribution[key] ?? 0) + 1;
      }
      stats.lastPlayedDate = next.puzzle.puzzleDate;
      saveStats(stats);
      const archive = loadArchive().filter((entry) => entry.id !== next.puzzle.id);
      archive.unshift({
        id: next.puzzle.id,
        puzzleDate: next.puzzle.puzzleDate,
        chartDate: next.puzzle.chartDate,
        title: next.puzzle.title,
        artist: next.puzzle.artist,
        position: next.puzzle.chartPosition,
        status: next.status,
        score: next.score,
        attempt: next.attempt
      });
      saveArchive(archive);
    }
    const solvedIn = next.attempt + 1;
    const summaryLabel = won ? `Solved in ${solvedIn}` : "Not solved";
    onComplete?.({
      gameId: "needledrop",
      displayName: "NeedleDrop",
      icon: "🎵",
      score: next.score,
      maxScore: 100,
      completed: true,
      successUnits: won ? solvedIn : 0,
      totalUnits: 7,
      summaryLabel,
      shareLine: `🎵 NeedleDrop: ${next.score}/100, ${summaryLabel.toLowerCase()}`,
      reviewData: {
        type: "needledrop",
        songTitle: next.puzzle.title,
        artist: next.puzzle.artist,
        chartDate: next.puzzle.chartDate,
        chartPosition: next.puzzle.chartPosition,
        artworkUrl: next.puzzle.track.artworkUrl,
        userGuesses: next.guesses,
        won
      },
      detail: summaryLabel
    });
    setShowResult(!embedded);
  }

  function advance(guess?: SongGuessSubmission) {
    if (!state || state.status !== "playing") return;
    const guesses = guess ? [...state.guesses, guess.displayValue] : state.guesses;
    if (guess && isCorrectGuess(guess, state.puzzle.title, state.puzzle.artist)) {
      finish({
        ...state,
        guesses,
        status: "won",
        score: scoreForAttempt(state.attempt),
        updatedAt: new Date().toISOString()
      });
      return;
    }
    if (guess) {
      setShake(true);
      setTimeout(() => setShake(false), 300);
    }
    if (state.attempt >= 6) {
      finish({ ...state, guesses, status: "lost", score: 0, updatedAt: new Date().toISOString() });
      return;
    }
    persist({ ...state, guesses, attempt: state.attempt + 1, updatedAt: new Date().toISOString() });
  }

  function giveUp() {
    if (!state || state.status !== "playing") return;
    finish({ ...state, status: "lost", score: 0, updatedAt: new Date().toISOString() });
  }

  return (
    <>
      {!embedded && <Header onStats={() => setShowStats(true)} />}
      <div className={embedded ? "w-full" : "mx-auto w-full max-w-xl px-4 pb-12"}>
        {loading && <LoadingState />}
        {!loading && error && <ErrorState message={error} retry={loadPuzzle} />}
        {!loading && state && (
          <>
            <div className="mb-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#db4e36] dark:text-[#ff826a]">Billboard time capsule</p>
              <h1 className="mt-1 text-xl font-black tracking-[-.03em] text-slate-900 dark:text-white">
                {formatChartDate(state.puzzle.chartDate)}
              </h1>
              <p className="mx-auto mt-1 max-w-sm text-[11px] font-semibold leading-4 text-slate-500 dark:text-slate-400">
                {chartContext(state.puzzle)}
              </p>
            </div>
            <section className={embedded ? "" : "theme-surface rounded-[2rem] border p-5 sm:p-7"}>
              <AttemptTracker attempt={state.attempt} />
              <AudioPlayer
                key={`${state.puzzle.id}-${state.attempt}`}
                src={state.puzzle.track.previewUrl}
                duration={SNIPPET_LENGTHS[Math.min(state.attempt, 6)]}
                ended={state.status !== "playing"}
              />
              {state.guesses.length > 0 && (
                <div className="mb-2 flex max-h-7 gap-1.5 overflow-hidden">
                  {state.guesses.slice(-2).map((guess, index) => (
                    <span key={`${guess}-${index}`} className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 line-through dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">
                      {guess}
                    </span>
                  ))}
                </div>
              )}
              <GuessInput
                disabled={state.status !== "playing"}
                shaking={shake}
                onGuess={(guess) => advance(guess)}
                onSkip={() => advance()}
                onGiveUp={giveUp}
              />
              {state.status !== "playing" && !embedded && (
                <button onClick={() => setShowResult(true)} className="mt-3 w-full rounded-2xl bg-coral px-5 py-3 font-extrabold text-white shadow-lg shadow-coral/20 hover:bg-[#dc553c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-coral/30 active:scale-[.98] dark:bg-[#ff7055] dark:hover:bg-[#ff8068]">
                  View today’s result
                </button>
              )}
            </section>
            {!embedded && <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">New daily at midnight Pacific</p>}
          </>
        )}
      </div>
      {showResult && state && !embedded && <ResultModal state={state} onClose={() => setShowResult(false)} />}
      {showStats && !embedded && <StatsModal onClose={() => setShowStats(false)} />}
    </>
  );
}
