"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getDailyGameDate } from "@/lib/date";
import { checkTopTenAnswer, topTenScore } from "@/games/top-ten/logic";
import type { TopTenPuzzle, TopTenState } from "@/games/top-ten/types";
import type { MinefieldGameResult } from "@/types/minefield";

const STORAGE_PREFIX = "minefield:top-ten:v2:";

function loadStored(date: string) {
  try {
    const value = localStorage.getItem(`${STORAGE_PREFIX}${date}`);
    return value ? (JSON.parse(value) as TopTenState) : null;
  } catch {
    return null;
  }
}

function saveStored(state: TopTenState) {
  localStorage.setItem(`${STORAGE_PREFIX}${state.puzzle.date}`, JSON.stringify(state));
}

export const topTenDefinition = {
  gameId: "top-ten" as const,
  displayName: "Top 10",
  maxScore: 100
};

export default function TopTenGame({
  onComplete
}: {
  onComplete: (result: MinefieldGameResult) => void;
}) {
  const [state, setState] = useState<TopTenState | null>(null);
  const [guess, setGuess] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [justFound, setJustFound] = useState("");
  const [copied, setCopied] = useState(false);

  const reportCompletion = useCallback((next: TopTenState) => {
    onComplete({
      gameId: "top-ten",
      displayName: "Top 10",
      score: topTenScore(next.found),
      maxScore: 100,
      completed: true,
      detail: next.status === "completed" ? "Perfect 10/10" : `${next.found.length}/10 found`
    });
  }, [onComplete]);

  useEffect(() => {
    const date = getDailyGameDate();
    const stored = loadStored(date);
    if (stored) {
      setState(stored);
      if (stored.status !== "playing") reportCompletion(stored);
      setLoading(false);
      return;
    }
    fetch(`/api/top-ten/generate?date=${date}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error);
        const next: TopTenState = {
          puzzle: payload as TopTenPuzzle,
          found: [],
          misses: [],
          status: "playing",
          updatedAt: new Date().toISOString()
        };
        saveStored(next);
        setState(next);
      })
      .catch((reason) => {
        const message = reason instanceof Error ? reason.message : "Top 10 could not load.";
        setError(message);
        onComplete({
          gameId: "top-ten",
          displayName: "Top 10",
          score: 0,
          maxScore: 100,
          completed: true,
          detail: "Unavailable today"
        });
      })
      .finally(() => setLoading(false));
  }, [onComplete, reportCompletion]);

  function persist(next: TopTenState) {
    saveStored(next);
    setState(next);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!state || state.status !== "playing" || !guess.trim()) return;
    const match = checkTopTenAnswer(guess, state.puzzle, state.found);
    if (!match) {
      setShake(true);
      setTimeout(() => setShake(false), 280);
      persist({ ...state, misses: [...state.misses, guess.trim()].slice(-5), updatedAt: new Date().toISOString() });
      setGuess("");
      return;
    }
    const found = [...state.found, match];
    const status = found.length === 10 ? "completed" as const : "playing" as const;
    const next = { ...state, found, status, updatedAt: new Date().toISOString() };
    setJustFound(match);
    setTimeout(() => setJustFound(""), 700);
    setGuess("");
    persist(next);
    if (status === "completed") reportCompletion(next);
  }

  function giveUp() {
    if (!state || state.status !== "playing") return;
    const next = { ...state, status: "gave-up" as const, updatedAt: new Date().toISOString() };
    persist(next);
    reportCompletion(next);
  }

  async function share() {
    if (!state) return;
    const found = state.found.length;
    const boxes = Array.from({ length: 10 }, (_, index) =>
      index < found ? "🟩" : "⬜"
    ).join("");
    const text = [
      "Minefield: Top 10",
      state.puzzle.date,
      "",
      `${found}/10`,
      `Score: ${topTenScore(state.found)}`,
      "",
      boxes
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading) {
    return <div className="py-14 text-center text-sm font-semibold text-slate-500 dark:text-slate-300">Building today’s list…</div>;
  }
  if (error || !state) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
        <p className="font-extrabold">Top 10 unavailable for today.</p>
        <p className="mt-1">{error || "Today’s Top 10 could not be generated. Please try again later."}</p>
        <p className="mt-3 text-xs opacity-75">You can continue to the next Minefield game.</p>
      </div>
    );
  }

  const ended = state.status !== "playing";
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-violet/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-violet dark:bg-violet/25 dark:text-[#aaa2ff]">
          {state.puzzle.category.topicArea}
        </span>
        <span className="text-sm font-black text-slate-700 dark:text-white">{state.found.length}/10</span>
      </div>
      <h3 className="mt-4 text-2xl font-black leading-tight tracking-tight text-slate-950 dark:text-white">
        {state.puzzle.category.prompt}
      </h3>
      <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-[#292e38]">
        <div className="h-full rounded-full bg-violet transition-all duration-300 dark:bg-[#7569e5]" style={{ width: `${state.found.length * 10}%` }} />
      </div>

      <div className="mt-5 space-y-2">
        {state.puzzle.answers.map((answer) => {
          const found = state.found.includes(answer.name);
          return (
            <div
              key={answer.rank}
              className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-bold ${
                found
                  ? `border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200 ${justFound === answer.name ? "scale-[1.03]" : ""}`
                  : ended
                    ? "border-slate-200 bg-slate-100 text-slate-600 dark:border-[#3b424f] dark:bg-[#292e38] dark:text-slate-300"
                    : "border-slate-200 bg-white text-slate-400 dark:border-[#343a47] dark:bg-[#20242c] dark:text-slate-500"
              }`}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-current/15 bg-black/[.04] text-xs font-black dark:bg-white/[.06]">
                {answer.rank}
              </span>
              <span className="min-w-0 flex-1 leading-5">
                {found || ended ? answer.name : "Hidden"}
              </span>
            </div>
          );
        })}
      </div>

      {!ended ? (
        <form onSubmit={submit} className={`mt-5 ${shake ? "animate-shake" : ""}`}>
          <input
            value={guess}
            onChange={(event) => setGuess(event.target.value)}
            placeholder="Type an answer…"
            autoComplete="off"
            className="h-14 w-full rounded-2xl border border-slate-300 bg-white px-5 font-semibold text-slate-950 outline-none placeholder:text-slate-400 focus:border-violet focus:ring-4 focus:ring-violet/15 dark:border-[#454c5a] dark:bg-[#252a34] dark:text-white"
          />
          <button disabled={!guess.trim()} className="mt-3 h-13 w-full rounded-2xl bg-violet px-5 py-3.5 font-extrabold text-white shadow-lg shadow-violet/20 disabled:opacity-40 dark:bg-[#7569e5]">
            Submit answer
          </button>
          <button type="button" onClick={giveUp} className="mt-2 h-11 w-full rounded-xl text-sm font-bold text-slate-500 hover:bg-red-50 hover:text-red-700 dark:text-slate-400 dark:hover:bg-red-400/10 dark:hover:text-red-300">
            Give up / Reveal
          </button>
        </form>
      ) : (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-[#3b424f] dark:bg-[#252a34]">
          <p className="text-lg font-black text-slate-950 dark:text-white">
            {state.status === "completed" ? "Perfect 10/10!" : `${state.found.length}/10 found`}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Score: {topTenScore(state.found)} points</p>
          <button onClick={share} className="mt-3 rounded-xl bg-violet px-5 py-2.5 text-sm font-extrabold text-white dark:bg-[#7569e5]">
            {copied ? "Copied!" : "Share Top 10 result"}
          </button>
        </div>
      )}
      <p className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
        Daily category · {state.puzzle.category.title}
      </p>
    </div>
  );
}
