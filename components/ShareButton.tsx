"use client";

import { useState } from "react";
import type { GameState } from "@/types/game";
import { formatChartDate } from "@/lib/date";

export function buildShareText(state: GameState) {
  const won = state.status === "won";
  const boxes = Array.from({ length: 7 }, (_, index) =>
    won && index <= state.attempt ? "🟩" : "⬜"
  ).join("");
  return [
    `NeedleDrop #${state.puzzle.number}`,
    formatChartDate(state.puzzle.chartDate),
    "Top 10 Billboard Hit",
    won ? `Solved in ${state.attempt + 1}/7` : "Failed",
    `Score: ${state.score}`,
    boxes,
    "",
    "Play Minefield:",
    "https://minefieldgame.com"
  ].join("\n");
}

export default function ShareButton({ state }: { state: GameState }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(buildShareText(state));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      onClick={copy}
      className="h-13 w-full rounded-2xl bg-violet px-5 py-3.5 font-extrabold text-white shadow-lg shadow-violet/25 hover:bg-[#594dc8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet/30 active:scale-[.98] dark:bg-[#7569e5] dark:hover:bg-[#8579f0]"
    >
      {copied ? "Copied!" : "Copy result"}
    </button>
  );
}
