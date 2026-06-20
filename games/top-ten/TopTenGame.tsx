"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { checkTopTenAnswer, topTenScore } from "@/games/top-ten/logic";
import type { TopTenPuzzle, TopTenState } from "@/games/top-ten/types";
import { getDailyGameDate } from "@/lib/date";
import type { MinefieldGameResult } from "@/types/minefield";

const STORAGE_PREFIX = "minefield:top-three:v1:";
const GAME_URL = "https://minefieldgame.com";

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
  displayName: "Top 3",
  maxScore: 100
};

export default function TopTenGame({ onComplete }: { onComplete: (result: MinefieldGameResult) => void }) {
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
      displayName: "Top 3",
      score: topTenScore(next.found),
      maxScore: 100,
      completed: true,
      detail: next.status === "completed" ? "Perfect 3/3" : `${next.found.length}/3 found`
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
      .catch(() => {
        setError("Today’s Top 3 could not be loaded.");
        onComplete({
          gameId: "top-ten",
          displayName: "Top 3",
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
      persist({ ...state, misses: [...state.misses, guess.trim()].slice(-3), updatedAt: new Date().toISOString() });
      setGuess("");
      return;
    }
    const found = [...state.found, match];
    const status = found.length === 3 ? "completed" as const : "playing" as const;
    const next = { ...state, found, status, updatedAt: new Date().toISOString() };
    setJustFound(match);
    setTimeout(() => setJustFound(""), 650);
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
    const boxes = Array.from({ length: 3 }, (_, index) => index < found ? "🟩" : "⬜").join("");
    await navigator.clipboard.writeText([
      "Minefield: Top 3",
      `${found}/3`,
      `Score: ${topTenScore(state.found)}`,
      boxes,
      "",
      "Play Minefield:",
      GAME_URL
    ].join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading) {
    return <div className="py-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-300">Building today’s list…</div>;
  }
  if (error || !state) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
        <p className="font-extrabold">Top 3 unavailable today.</p>
        <p className="mt-1 text-xs">Minefield will continue automatically.</p>
      </div>
    );
  }

  const ended = state.status !== "playing";
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-violet/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-violet dark:bg-violet/25 dark:text-[#aaa2ff]">
          {state.puzzle.category.topicArea}
        </span>
        <span className="text-sm font-black text-slate-700 dark:text-white">{state.found.length}/3</span>
      </div>
      <h3 className="mt-3 text-xl font-black leading-tight tracking-tight text-slate-950 dark:text-white">
        {state.puzzle.category.prompt}
      </h3>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {state.puzzle.answers.map((answer) => {
          const found = state.found.includes(answer.name);
          return (
            <div
              key={answer.rank}
              className={`flex min-h-20 flex-col items-center justify-center rounded-xl border px-2 py-2 text-center text-xs font-bold ${
                found
                  ? `border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200 ${justFound === answer.name ? "scale-[1.04]" : ""}`
                  : ended
                    ? "border-slate-200 bg-slate-100 text-slate-700 dark:border-[#3b424f] dark:bg-[#292e38] dark:text-slate-200"
                    : "border-slate-200 bg-white text-slate-400 dark:border-[#343a47] dark:bg-[#20242c] dark:text-slate-500"
              }`}
            >
              <span className="mb-1 grid h-6 w-6 place-items-center rounded-full bg-black/[.05] text-[10px] font-black dark:bg-white/[.07]">{answer.rank}</span>
              <span className="leading-4">{found || ended ? answer.name : "Hidden"}</span>
            </div>
          );
        })}
      </div>

      {!ended ? (
        <form onSubmit={submit} className={`mt-4 ${shake ? "animate-shake" : ""}`}>
          <input
            value={guess}
            onChange={(event) => setGuess(event.target.value)}
            placeholder="Type an answer…"
            autoComplete="off"
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-950 outline-none placeholder:text-slate-400 focus:border-violet focus:ring-4 focus:ring-violet/15 dark:border-[#454c5a] dark:bg-[#252a34] dark:text-white"
          />
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
            <button disabled={!guess.trim()} className="h-12 rounded-xl bg-violet px-5 font-extrabold text-white shadow-md disabled:opacity-40 dark:bg-[#7569e5]">
              Submit answer
            </button>
            <button type="button" onClick={giveUp} className="h-12 rounded-xl px-4 text-sm font-bold text-slate-500 hover:bg-red-50 hover:text-red-700 dark:text-slate-400 dark:hover:bg-red-400/10 dark:hover:text-red-300">
              Reveal
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-[#3b424f] dark:bg-[#252a34]">
          <p className="font-black text-slate-950 dark:text-white">{state.status === "completed" ? "Perfect 3/3!" : `${state.found.length}/3 found`} · {topTenScore(state.found)} points</p>
          <button onClick={share} className="mt-2 rounded-lg bg-violet px-4 py-2 text-xs font-extrabold text-white dark:bg-[#7569e5]">
            {copied ? "Copied!" : "Share Top 3"}
          </button>
        </div>
      )}
    </div>
  );
}
