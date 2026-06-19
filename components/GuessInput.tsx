"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import type { SongSuggestion } from "@/types/game";

type Props = {
  disabled: boolean;
  shaking: boolean;
  onGuess: (guess: string) => void;
  onSkip: () => void;
  onGiveUp: () => void;
};

export default function GuessInput({ disabled, shaking, onGuess, onSkip, onGiveUp }: Props) {
  const [guess, setGuess] = useState("");
  const [suggestions, setSuggestions] = useState<SongSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const query = guess.trim();
    if (disabled || query.length < 2) {
      requestRef.current?.abort();
      setSuggestions([]);
      setOpen(false);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeout = window.setTimeout(async () => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      try {
        const response = await fetch(`/api/itunes-search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        if (!response.ok) throw new Error("Suggestion search failed");
        const payload = (await response.json()) as { suggestions?: SongSuggestion[] };
        const next = payload.suggestions ?? [];
        setSuggestions(next);
        setActiveIndex(next.length ? 0 : -1);
        setOpen(next.length > 0);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 325);

    return () => window.clearTimeout(timeout);
  }, [disabled, guess]);

  function selectSuggestion(suggestion: SongSuggestion) {
    setGuess(`${suggestion.title} — ${suggestion.artist}`);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  function submitValue(value: string) {
    if (!value.trim()) return;
    onGuess(value.trim());
    setGuess("");
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    submitValue(guess);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || !suggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const suggestion = suggestions[activeIndex];
      submitValue(`${suggestion.title} — ${suggestion.artist}`);
    }
  }

  return (
    <form onSubmit={submit} className={shaking ? "animate-shake" : ""}>
      <div className="relative">
        <label htmlFor="guess" className="sr-only">Your song guess</label>
        <input
          id="guess"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="song-suggestions"
          aria-activedescendant={activeIndex >= 0 ? `song-suggestion-${activeIndex}` : undefined}
          value={guess}
          disabled={disabled}
          onChange={(event) => {
            setGuess(event.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length && setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          placeholder="Name that song…"
          autoComplete="off"
          className="h-[58px] w-full rounded-2xl border border-slate-300 bg-white px-5 pr-12 text-base font-semibold text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-violet focus:ring-4 focus:ring-violet/15 disabled:bg-slate-100 disabled:opacity-60 dark:border-[#454c5a] dark:bg-[#252a34] dark:text-white dark:placeholder:text-slate-500 dark:shadow-inner dark:focus:border-[#8175ee] dark:focus:ring-[#8175ee]/20 dark:disabled:bg-[#20242c]"
        />
        {searching && (
          <span className="absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-black/15 border-t-violet dark:border-white/20 dark:border-t-violet" />
        )}

        {open && suggestions.length > 0 && (
          <div
            id="song-suggestions"
            role="listbox"
            className="absolute inset-x-0 top-[66px] z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_20px_50px_rgba(23,23,28,.16)] dark:border-[#454c5a] dark:bg-[#252a34] dark:shadow-[0_24px_60px_rgba(0,0,0,.5)]"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                id={`song-suggestion-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectSuggestion(suggestion)}
                className={`block w-full rounded-xl px-3.5 py-3 text-left transition ${
                  index === activeIndex
                    ? "bg-violet/10 text-violet dark:bg-violet/30 dark:text-white"
                    : "hover:bg-slate-100 dark:hover:bg-white/[.07]"
                }`}
              >
                <span className="block truncate text-sm font-extrabold">{suggestion.title}</span>
                <span className="mt-0.5 block truncate text-xs font-medium text-slate-500 dark:text-slate-300">
                  {suggestion.artist}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={disabled || !guess.trim()}
        className="mt-3 h-14 w-full rounded-2xl bg-violet font-extrabold text-white shadow-lg shadow-violet/25 hover:bg-[#594dc8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet/30 active:scale-[.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none dark:bg-[#7569e5] dark:hover:bg-[#8579f0] dark:disabled:bg-[#343946] dark:disabled:text-slate-500"
      >
        Submit guess
      </button>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={onSkip}
          className="h-12 rounded-2xl border border-slate-200 bg-slate-100 font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet/20 active:scale-[.97] disabled:opacity-40 dark:border-[#3d4451] dark:bg-[#292e38] dark:text-slate-100 dark:hover:border-[#505867] dark:hover:bg-[#343a46]"
        >
          Skip
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onGiveUp}
          className="h-12 rounded-2xl font-bold text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/15 active:scale-[.97] disabled:opacity-40 dark:text-slate-400 dark:hover:bg-red-400/10 dark:hover:text-red-300"
        >
          Give up
        </button>
      </div>
    </form>
  );
}
