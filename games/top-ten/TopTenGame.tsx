"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  correctOrder,
  evaluateRankedOrder,
  initialRankedOrder,
  moveAmongUnlocked,
  rankedTopTenLabel,
  rankedTopTenScore
} from "@/games/top-ten/logic";
import type { RankedTopTenPuzzle, RankedTopTenState } from "@/games/top-ten/types";
import { fetchDailyPuzzle } from "@/lib/content/clientCache";
import { getGameCacheKey, getPacificDateKey } from "@/lib/date";
import type { MinefieldGameResult } from "@/types/minefield";

const GAME_ID = "ranked-top-10";
const MAX_ATTEMPTS = 3;

export const topTenDefinition = {
  gameId: "ranked-top-10" as const,
  displayName: "Top 10",
  maxScore: 100
};

export default function TopTenGame({
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
  const [state, setState] = useState<RankedTopTenState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeAnswer, setActiveAnswer] = useState<string | null>(null);
  const [feedbackPositions, setFeedbackPositions] = useState<number[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const reportCompletion = useCallback((next: RankedTopTenState) => {
    const score = rankedTopTenScore(next.lockedPositions);
    const placed = next.lockedPositions.length;
    const label = rankedTopTenLabel(score);
    onComplete({
      gameId: GAME_ID,
      displayName: "Top 10",
      icon: "🏆",
      score,
      maxScore: 100,
      completed: true,
      successUnits: placed,
      totalUnits: 10,
      summaryLabel: score === 100 ? label : `${placed}/10 placed`,
      shareLine: score === 100
        ? "🏆 Top 10: 100/100, perfect ranking"
        : `🏆 Top 10: ${score}/100, ${placed}/10 placed`,
      reviewData: {
        type: "ranked-top-10",
        prompt: next.puzzle.playerPrompt,
        userOrder: next.order,
        correctOrder: correctOrder(next.puzzle),
        correctPositions: next.lockedPositions,
        attemptsUsed: next.attemptsUsed
      },
      detail: label
    });
  }, [onComplete]);

  useEffect(() => {
    setLoading(true);
    setError("");
    setState(null);
    setFeedbackPositions([]);
    setActiveAnswer(null);
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as RankedTopTenState;
        if (parsed.dateKey === date && parsed.puzzle?.date === date && parsed.puzzle.gameId === GAME_ID) {
          setState(parsed);
          if (parsed.status !== "playing") reportCompletion(parsed);
          setLoading(false);
          return;
        }
      }
    } catch {
      localStorage.removeItem(storageKey);
    }

    fetchDailyPuzzle<RankedTopTenPuzzle>(GAME_ID, date, `/api/top-ten/generate?date=${date}`)
      .then((puzzle) => {
        if (puzzle.date !== date || puzzle.gameId !== GAME_ID) {
          throw new Error("Ranked Top 10 returned the wrong date.");
        }
        const next: RankedTopTenState = {
          dateKey: date,
          puzzle,
          order: initialRankedOrder(puzzle),
          lockedPositions: [],
          attemptsUsed: 0,
          lastIncorrectPositions: [],
          status: "playing",
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem(storageKey, JSON.stringify(next));
        setState(next);
      })
      .catch(() => {
        setError("Today’s Top 10 could not be loaded.");
        onComplete({
          gameId: GAME_ID,
          displayName: "Top 10",
          icon: "🏆",
          score: 0,
          maxScore: 100,
          completed: true,
          successUnits: 0,
          totalUnits: 10,
          summaryLabel: "Unavailable today",
          shareLine: "🏆 Top 10: unavailable",
          reviewData: { type: "legacy", message: "Today’s puzzle was unavailable." }
        });
      })
      .finally(() => setLoading(false));
  }, [date, onComplete, reportCompletion, storageKey]);

  useEffect(() => {
    if (!activeAnswer) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    const preventTouchMove = (event: TouchEvent) => event.preventDefault();
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.addEventListener("touchmove", preventTouchMove, { passive: false });
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      document.removeEventListener("touchmove", preventTouchMove);
    };
  }, [activeAnswer]);

  function persist(next: RankedTopTenState) {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setState(next);
  }

  function move(fromIndex: number, toIndex: number) {
    if (!state || state.status !== "playing") return;
    const order = moveAmongUnlocked(state.order, fromIndex, toIndex, state.lockedPositions);
    if (order === state.order) return;
    setFeedbackPositions([]);
    persist({ ...state, order, updatedAt: new Date().toISOString() });
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveAnswer(String(event.active.id));
    if ("vibrate" in navigator) navigator.vibrate(15);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveAnswer(null);
    if (!state || !event.over || event.active.id === event.over.id) return;
    move(state.order.indexOf(String(event.active.id)), state.order.indexOf(String(event.over.id)));
  }

  function submit() {
    if (!state || state.status !== "playing") return;
    const correctPositions = evaluateRankedOrder(state.order, state.puzzle);
    const lockedPositions = [...new Set([...state.lockedPositions, ...correctPositions])].sort((a, b) => a - b);
    const incorrectPositions = state.order.map((_, index) => index).filter((index) => !lockedPositions.includes(index));
    const attemptsUsed = state.attemptsUsed + 1;
    const completed = lockedPositions.length === 10 || attemptsUsed >= MAX_ATTEMPTS;
    const next: RankedTopTenState = {
      ...state,
      lockedPositions,
      attemptsUsed,
      lastIncorrectPositions: incorrectPositions,
      status: completed ? "completed" : "playing",
      updatedAt: new Date().toISOString()
    };
    setFeedbackPositions(incorrectPositions);
    window.setTimeout(() => setFeedbackPositions([]), 700);
    persist(next);
    if (completed) reportCompletion(next);
  }

  function giveUp() {
    if (!state || state.status !== "playing") return;
    const lockedPositions = [...new Set([
      ...state.lockedPositions,
      ...evaluateRankedOrder(state.order, state.puzzle)
    ])].sort((a, b) => a - b);
    const next: RankedTopTenState = {
      ...state,
      lockedPositions,
      status: "gave-up",
      updatedAt: new Date().toISOString()
    };
    persist(next);
    reportCompletion(next);
  }

  const answerLabels = useMemo(
    () => new Map(state?.puzzle.answers.map((answer) => [answer.answer, answer.displayAnswer || answer.answer]) ?? []),
    [state?.puzzle.answers]
  );

  if (loading) {
    return <div className="py-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-300">Building today’s ranking…</div>;
  }
  if (error || !state) {
    return <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">Today’s Top 10 is unavailable. Moving on automatically.</div>;
  }

  const ended = state.status !== "playing";
  const activeLabel = activeAnswer ? answerLabels.get(activeAnswer) ?? activeAnswer : "";
  return (
    <div className="overscroll-none">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-violet/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-violet dark:bg-violet/25 dark:text-[#aaa2ff]">
          {state.puzzle.category}
        </span>
        <span className="shrink-0 text-xs font-black text-slate-600 dark:text-slate-200">
          Attempt {Math.min(state.attemptsUsed + 1, MAX_ATTEMPTS)} of {MAX_ATTEMPTS}
        </span>
      </div>
      <h3 className="mt-2 text-base font-black leading-tight text-slate-950 dark:text-white">
        {state.puzzle.playerPrompt}
      </h3>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragCancel={() => setActiveAnswer(null)}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={state.order} strategy={verticalListSortingStrategy}>
          <div className="mt-3 touch-none space-y-1 overscroll-none">
            {state.order.map((answer, index) => (
              <SortableRankCard
                key={answer}
                id={answer}
                index={index}
                label={answerLabels.get(answer) ?? answer}
                locked={state.lockedPositions.includes(index)}
                incorrect={feedbackPositions.includes(index)}
                disabled={ended}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
          {activeAnswer ? (
            <div className="flex h-11 items-center gap-3 rounded-xl border-2 border-violet bg-white px-3 text-sm font-extrabold text-slate-900 shadow-2xl dark:bg-[#252a34] dark:text-white">
              <span className="text-violet">☰</span>
              <span className="truncate">{activeLabel}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {!ended && (
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <button onClick={submit} className="h-11 rounded-xl bg-violet px-5 text-sm font-extrabold text-white shadow-md dark:bg-[#7569e5]">
            Submit ranking
          </button>
          <button onClick={giveUp} className="h-11 rounded-xl px-4 text-sm font-bold text-slate-500 hover:bg-red-50 hover:text-red-700 dark:text-slate-400 dark:hover:bg-red-400/10 dark:hover:text-red-300">
            Give Up
          </button>
        </div>
      )}
    </div>
  );
}

function SortableRankCard({
  id,
  index,
  label,
  locked,
  incorrect,
  disabled
}: {
  id: string;
  index: number;
  label: string;
  locked: boolean;
  incorrect: boolean;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id, disabled: locked || disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={`flex h-11 touch-none select-none items-center gap-3 rounded-xl border px-3 shadow-sm outline-none transition-colors focus-visible:ring-4 focus-visible:ring-violet/25 ${
        locked
          ? "animate-[pulse_.35s_ease-out_1] border-emerald-400 bg-emerald-500/12 text-emerald-800 shadow-emerald-500/15 dark:border-emerald-400/40 dark:text-emerald-200"
          : incorrect
            ? "border-red-400 bg-red-500/10 text-red-800 dark:border-red-400/40 dark:text-red-200"
            : isDragging
              ? "border-violet bg-violet/10 opacity-30"
              : "cursor-grab border-slate-200 bg-white text-slate-800 shadow-[0_3px_10px_rgba(15,23,42,.08)] active:cursor-grabbing dark:border-[#3b424f] dark:bg-[#252a34] dark:text-white"
      }`}
      aria-label={`${index + 1}. ${label}${locked ? ", locked" : ", draggable"}`}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-black/[.05] text-xs font-black dark:bg-white/[.07]">
        {index + 1}
      </span>
      <span className={`text-lg ${locked ? "text-emerald-600" : "text-slate-400"}`}>{locked ? "✓" : "☰"}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{label}</span>
      {locked && <span className="text-[10px] font-black uppercase tracking-wider">Locked</span>}
    </div>
  );
}
