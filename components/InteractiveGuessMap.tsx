"use client";

import { useRef } from "react";

export type MapPoint = { latitude: number; longitude: number };

function toPercent(point: MapPoint) {
  return { x: ((point.longitude + 180) / 360) * 100, y: ((90 - point.latitude) / 180) * 100 };
}

export default function InteractiveGuessMap({
  guess,
  onGuess,
  correct,
  disabled = false,
  label = "World map. Tap to place your pin."
}: {
  guess: MapPoint | null;
  onGuess?: (point: MapPoint) => void;
  correct?: MapPoint | null;
  disabled?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function place(clientX: number, clientY: number) {
    if (disabled || !onGuess || !ref.current) return;
    const bounds = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width));
    const y = Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height));
    onGuess({ longitude: x * 360 - 180, latitude: 90 - y * 180 });
  }

  const guessPosition = guess ? toPercent(guess) : null;
  const correctPosition = correct ? toPercent(correct) : null;
  return (
    <div
      ref={ref}
      role="application"
      aria-label={label}
      onPointerDown={(event) => place(event.clientX, event.clientY)}
      className={`relative aspect-[2/1] w-full overflow-hidden rounded-2xl border border-slate-300 bg-[#dceefa] shadow-inner dark:border-[#454c5a] dark:bg-[#172534] ${disabled ? "cursor-default" : "cursor-crosshair touch-none"}`}
    >
      <svg viewBox="0 0 1000 500" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="ocean" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#dff4ff" /><stop offset="1" stopColor="#bcdced" />
          </linearGradient>
          <pattern id="grid" width="125" height="125" patternUnits="userSpaceOnUse">
            <path d="M125 0H0V125" fill="none" stroke="currentColor" strokeOpacity=".14" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="1000" height="500" fill="url(#ocean)" className="dark:opacity-20" />
        <g fill="#8fbb9d" stroke="#6f9e80" strokeWidth="3" opacity=".96">
          <path d="M70 112 130 65l105 10 73 52-12 66-58 27-22 68-62 42-43-75-53-48Z" />
          <path d="m240 286 67 22 35 56-18 91-49 32-24-76-33-66Z" />
          <path d="m450 105 62-42 106 20 55 48 81-1 66 43-9 55-83 22-50 72-79-15-37-62-76-20-42-61Z" />
          <path d="m535 251 73 14 52 72-25 111-57 19-54-81-13-73Z" />
          <path d="m800 341 77-28 69 40-13 65-86 22-57-50Z" />
          <path d="m896 95 35-24 32 23-18 38-40 6Z" />
          <path d="m392 82 25-17 29 12-10 31-35 5Z" />
        </g>
        <rect width="1000" height="500" fill="url(#grid)" className="text-slate-600 dark:text-slate-200" />
      </svg>
      {guessPosition && (
        <span className="absolute z-10 -translate-x-1/2 -translate-y-full drop-shadow-lg" style={{ left: `${guessPosition.x}%`, top: `${guessPosition.y}%` }}>
          <span className="block h-5 w-5 rounded-full border-[4px] border-white bg-violet shadow-md" />
          <span className="mx-auto block h-2 w-1 bg-violet" />
        </span>
      )}
      {correctPosition && (
        <span className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${correctPosition.x}%`, top: `${correctPosition.y}%` }}>
          <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-emerald-500 text-xs font-black text-white shadow-lg">✓</span>
        </span>
      )}
      {!guess && !disabled && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center">
          <span className="rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-black text-slate-700 shadow-sm dark:bg-[#20242c]/90 dark:text-white">Tap anywhere to place your pin</span>
        </div>
      )}
    </div>
  );
}
