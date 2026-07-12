"use client";

import { useCallback, useEffect, useState } from "react";
import { buildVaultbreakShareRow, formatVaultbreakElapsed } from "@/games/vaultbreak/logic";
import type {
  VaultbreakPlayerPuzzle,
  VaultbreakSubmissionResult
} from "@/games/vaultbreak/types";
import { fetchDailyPuzzle } from "@/lib/content/clientCache";
import { getGameCacheKey, getPacificDateKey } from "@/lib/date";
import type { MinefieldGameResult } from "@/types/minefield";

const GAME_ID = "vaultbreak";

type VaultbreakPlayerPayload = VaultbreakPlayerPuzzle & {
  date: string;
  cacheHit?: boolean;
};

type SavedVaultbreakProgress = {
  date: string;
  puzzle: VaultbreakPlayerPayload;
  digits: string[];
  activeSlot: number;
  startedAt: number;
  submittedCode: string;
  result: VaultbreakSubmissionResult | null;
};

function assertPlayerSafePuzzle(payload: VaultbreakPlayerPayload, date: string) {
  if (payload.gameId !== GAME_ID || payload.date !== date) throw new Error("Vaultbreak returned the wrong game or date.");
  if ("secretCode" in payload || "explanation" in payload || "diagnostics" in payload) {
    throw new Error("Vaultbreak player payload exposed admin-only solution data.");
  }
  if (!Array.isArray(payload.clues) || payload.clues.length < 4 || payload.clues.length > 7) {
    throw new Error("Vaultbreak requires four to seven clues.");
  }
  if (!payload.rules?.noRepeatedDigits || payload.rules.codeLength !== 4 || !payload.contentHash) {
    throw new Error("Vaultbreak returned incomplete validation rules.");
  }
  return payload;
}

export default function VaultbreakGame({
  onComplete,
  date: selectedDate,
  storageScope
}: {
  onComplete: (result: MinefieldGameResult) => void;
  date?: string;
  storageScope?: string;
}) {
  const date = selectedDate ?? getPacificDateKey();
  const storageKey = getGameCacheKey(GAME_ID, date, storageScope);
  const [puzzle, setPuzzle] = useState<VaultbreakPlayerPayload | null>(null);
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [result, setResult] = useState<VaultbreakSubmissionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reportCompletion = useCallback((
    completedPuzzle: VaultbreakPlayerPayload,
    submittedCode: string,
    completed: VaultbreakSubmissionResult
  ) => {
    const summaryLabel = completed.solved
      ? `Vault opened in ${formatVaultbreakElapsed(completed.elapsedSeconds)}`
      : `${completed.exactDigits}/4 digits exact · code ${completed.correctCode}`;
    const shareRow = buildVaultbreakShareRow(completed).replace(
      /^Vaultbreak /,
      `Vaultbreak ${completed.score} · `
    );
    onComplete({
      gameId: GAME_ID,
      displayName: "Vaultbreak",
      icon: "🔐",
      score: completed.score,
      maxScore: 100,
      completed: true,
      successUnits: completed.exactDigits,
      totalUnits: 4,
      summaryLabel,
      shareLine: shareRow,
      reviewData: {
        type: GAME_ID,
        clueTexts: completedPuzzle.clues.map((clue) => clue.text),
        submittedCode,
        correctCode: completed.correctCode,
        exactDigits: completed.exactDigits,
        opened: completed.solved,
        elapsedSeconds: completed.elapsedSeconds,
        difficulty: completedPuzzle.difficulty,
        explanation: completed.explanation
      },
      detail: summaryLabel
    });
  }, [onComplete]);

  useEffect(() => {
    setLoading(true);
    setError("");
    setPuzzle(null);
    setResult(null);
    fetchDailyPuzzle<VaultbreakPlayerPayload>(GAME_ID, date, `/api/vaultbreak?date=${date}`)
      .then((payload) => {
        const playable = assertPlayerSafePuzzle(payload, date);
        setPuzzle(playable);
        const now = Date.now();
        try {
          const raw = localStorage.getItem(storageKey);
          const saved = raw ? JSON.parse(raw) as SavedVaultbreakProgress : null;
          if (saved?.date === date && saved.puzzle?.contentHash === playable.contentHash) {
            const restoredDigits = Array.isArray(saved.digits) && saved.digits.length === 4 ? saved.digits : ["", "", "", ""];
            setDigits(restoredDigits);
            setActiveSlot(Math.max(0, Math.min(3, saved.activeSlot ?? 0)));
            setStartedAt(saved.startedAt || now);
            if (saved.result && saved.submittedCode) {
              setResult(saved.result);
              setElapsedSeconds(saved.result.elapsedSeconds);
              reportCompletion(playable, saved.submittedCode, saved.result);
            }
            return;
          }
        } catch {
          localStorage.removeItem(storageKey);
        }
        setDigits(["", "", "", ""]);
        setActiveSlot(0);
        setStartedAt(now);
      })
      .catch(() => {
        setError("Today's Vaultbreak puzzle could not be loaded.");
        onComplete({
          gameId: GAME_ID,
          displayName: "Vaultbreak",
          icon: "🔐",
          score: 0,
          maxScore: 100,
          completed: true,
          successUnits: 0,
          totalUnits: 4,
          summaryLabel: "Unavailable today",
          shareLine: "🔐 Vaultbreak: unavailable",
          reviewData: { type: "legacy", message: "Today's Vaultbreak puzzle was unavailable." }
        });
      })
      .finally(() => setLoading(false));
  }, [date, onComplete, reportCompletion, storageKey]);

  useEffect(() => {
    if (!puzzle || !startedAt || result) return;
    const update = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [puzzle, result, startedAt]);

  useEffect(() => {
    if (!puzzle || !startedAt || result) return;
    const progress: SavedVaultbreakProgress = {
      date,
      puzzle,
      digits,
      activeSlot,
      startedAt,
      submittedCode: "",
      result: null
    };
    localStorage.setItem(storageKey, JSON.stringify(progress));
  }, [activeSlot, date, digits, puzzle, result, startedAt, storageKey]);

  const enterDigit = useCallback((digit: string) => {
    if (result || submitting) return;
    setError("");
    if (digits.some((value, index) => index !== activeSlot && value === digit)) {
      setError("The daily code does not repeat digits.");
      return;
    }
    setDigits((current) => {
      const next = [...current];
      next[activeSlot] = digit;
      return next;
    });
    setActiveSlot((slot) => Math.min(3, slot + 1));
  }, [activeSlot, digits, result, submitting]);

  const eraseDigit = useCallback(() => {
    if (result || submitting) return;
    setError("");
    setDigits((current) => {
      const next = [...current];
      if (next[activeSlot]) next[activeSlot] = "";
      else {
        const previous = Math.max(0, activeSlot - 1);
        next[previous] = "";
        setActiveSlot(previous);
      }
      return next;
    });
  }, [activeSlot, result, submitting]);

  useEffect(() => {
    if (!puzzle || result) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        enterDigit(event.key);
      } else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        eraseDigit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enterDigit, eraseDigit, puzzle, result]);

  async function submitCode() {
    if (!puzzle || result || submitting) return;
    const submittedCode = digits.join("");
    if (!/^\d{4}$/.test(submittedCode)) {
      setError("Enter all four digits before submitting.");
      return;
    }
    if (new Set(submittedCode).size !== 4) {
      setError("The daily code does not repeat digits.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/vaultbreak?date=${date}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submittedCode, elapsedSeconds }),
        cache: "no-store"
      });
      const body = await response.json() as VaultbreakSubmissionResult & { message?: string };
      if (!response.ok) throw new Error(body.message ?? "Vaultbreak submission failed.");
      setResult(body);
      setElapsedSeconds(body.elapsedSeconds);
      const saved: SavedVaultbreakProgress = {
        date,
        puzzle,
        digits,
        activeSlot,
        startedAt,
        submittedCode,
        result: body
      };
      localStorage.setItem(storageKey, JSON.stringify(saved));
      reportCompletion(puzzle, submittedCode, body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your code could not be checked.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="py-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-300">Setting today's vault tumblers…</div>;
  if (!puzzle) return <div role="status" className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">Vaultbreak is unavailable today. Moving to the next game.</div>;

  return (
    <div className="min-w-0">
      <div className="rounded-2xl border border-violet/20 bg-gradient-to-br from-slate-950 to-violet/80 p-4 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-200">The Daily Vault</p>
            <h3 className="mt-1 text-xl font-black">{result?.solved ? "Vault opened." : "Crack the access code"}</h3>
          </div>
          <span aria-hidden="true" className="text-3xl">{result?.solved ? "🔓" : "🔐"}</span>
        </div>
        <p className="mt-2 text-sm font-semibold leading-5 text-slate-200">{puzzle.prompt}</p>
        <div className="mt-3 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-300">
          <span>{puzzle.difficulty}</span>
          <span aria-live="polite">{formatVaultbreakElapsed(elapsedSeconds)} elapsed</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2" role="group" aria-label="Four digit vault code">
        {digits.map((digit, index) => (
          <button
            key={index}
            type="button"
            onClick={() => !result && setActiveSlot(index)}
            aria-label={`Code digit ${index + 1}${digit ? `, ${digit}` : ", empty"}`}
            aria-pressed={!result && activeSlot === index}
            className={`grid aspect-square min-w-0 place-items-center rounded-xl border text-2xl font-black outline-none transition focus-visible:ring-4 focus-visible:ring-violet/30 ${
              result
                ? result.slotMatches[index]
                  ? "border-emerald-400 bg-emerald-500 text-white"
                  : "border-red-400 bg-red-500 text-white"
                : activeSlot === index
                  ? "border-violet bg-violet/10 text-violet ring-2 ring-violet/20 dark:text-[#aaa2ff]"
                  : "border-slate-300 bg-white text-slate-950 dark:border-[#454c5a] dark:bg-[#252a34] dark:text-white"
            }`}
          >
            {result ? result.correctCode[index] : digit || "·"}
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400">Four distinct digits · 0 can appear first · no countdown</p>

      {!result && (
        <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Vault number keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button key={digit} type="button" onClick={() => enterDigit(digit)} className="min-h-11 rounded-xl border border-slate-300 bg-white text-lg font-black text-slate-900 shadow-sm active:scale-[.98] dark:border-[#454c5a] dark:bg-[#292e38] dark:text-white">{digit}</button>
          ))}
          <button type="button" onClick={() => { setDigits(["", "", "", ""]); setActiveSlot(0); setError(""); }} className="min-h-11 rounded-xl border border-slate-300 bg-slate-100 text-xs font-black uppercase text-slate-600 dark:border-[#454c5a] dark:bg-[#292e38] dark:text-slate-300">Clear</button>
          <button type="button" onClick={() => enterDigit("0")} className="min-h-11 rounded-xl border border-slate-300 bg-white text-lg font-black text-slate-900 shadow-sm active:scale-[.98] dark:border-[#454c5a] dark:bg-[#292e38] dark:text-white">0</button>
          <button type="button" onClick={eraseDigit} aria-label="Erase digit" className="min-h-11 rounded-xl border border-slate-300 bg-slate-100 text-lg font-black text-slate-600 dark:border-[#454c5a] dark:bg-[#292e38] dark:text-slate-300">⌫</button>
        </div>
      )}

      <div className="mt-4 space-y-2" aria-label="Vaultbreak clues">
        {puzzle.clues.map((clue, index) => (
          <div key={clue.id} className="theme-raised flex min-w-0 gap-3 rounded-xl border p-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet/10 text-xs font-black text-violet dark:text-[#aaa2ff]">{index + 1}</span>
            <div className="min-w-0">
              <p className="break-words text-sm font-bold leading-5 text-slate-800 dark:text-slate-100">{clue.text}</p>
              <p className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-slate-400">{clue.category}</p>
            </div>
          </div>
        ))}
      </div>

      {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">{error}</p>}

      {!result ? (
        <button type="button" onClick={submitCode} disabled={submitting || digits.some((digit) => !digit)} className="mt-4 min-h-12 w-full rounded-xl bg-violet px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-violet/20 disabled:opacity-40 dark:bg-[#7569e5]">
          {submitting ? "Checking tumblers…" : "Submit final code"}
        </button>
      ) : (
        <div className={`mt-4 rounded-2xl border p-4 ${result.solved ? "border-emerald-300 bg-emerald-500/10" : "border-amber-300 bg-amber-500/10"}`} role="status" aria-live="polite">
          <h4 className="font-black text-slate-950 dark:text-white">{result.solved ? "Vault opened." : `Lock jammed. The code was ${result.correctCode}.`}</h4>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-slate-500">Score</span><p className="font-black">{result.score}/100</p></div>
            <div><span className="text-slate-500">Exact digits</span><p className="font-black">{result.exactDigits}/4</p></div>
            <div><span className="text-slate-500">Elapsed</span><p className="font-black">{formatVaultbreakElapsed(result.elapsedSeconds)}</p></div>
            <div><span className="text-slate-500">Speed bonus</span><p className="font-black">+{result.speedBonus}</p></div>
          </div>
          <details className="mt-3 rounded-xl border border-slate-200 bg-white/50 dark:border-white/10 dark:bg-black/10" open>
            <summary className="cursor-pointer px-3 py-2 text-xs font-black uppercase tracking-wider">Why this is the only code</summary>
            <ol className="space-y-1 border-t border-slate-200 px-3 py-2 text-xs font-semibold leading-5 text-slate-600 dark:border-white/10 dark:text-slate-300">
              {result.explanation.map((step, index) => <li key={`${index}-${step}`}>{index + 1}. {step}</li>)}
            </ol>
          </details>
        </div>
      )}
    </div>
  );
}
