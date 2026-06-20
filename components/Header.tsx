"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = { onStats?: () => void };

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
      <circle cx="12" cy="12" r="3.5" fill="currentColor" />
      <path d="M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[17px] w-[17px]">
      <path d="M20 15.2A8.1 8.1 0 0 1 8.8 4a8.25 8.25 0 1 0 11.2 11.2Z" fill="currentColor" />
    </svg>
  );
}

export default function Header({ onStats }: Props) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("needledrop:theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const enabled = saved ? saved === "dark" : prefersDark;
    setDark(enabled);
    document.documentElement.classList.toggle("dark", enabled);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("needledrop:theme", next ? "dark" : "light");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-white/[.08] dark:bg-[#111318]/85">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-2.5">
        <Link href="/" className="group rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet/25" aria-label="Minefield home">
          <Image
            src="/minefield-logo.png"
            alt="Minefield"
            width={720}
            height={710}
            priority
            className="h-16 w-auto object-contain drop-shadow-sm transition-transform duration-200 group-hover:scale-[1.04] sm:h-[68px]"
            sizes="68px"
          />
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/archive"
            className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet/20 dark:text-slate-300 dark:hover:bg-white/[.08] dark:hover:text-white"
          >
            Archive
          </Link>
          {onStats && (
            <button
              onClick={onStats}
              className="rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet/20 dark:text-slate-300 dark:hover:bg-white/[.08] dark:hover:text-white"
            >
              Stats
            </button>
          )}
          <button
            onClick={toggleTheme}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={dark}
            className="relative ml-1 flex h-10 w-[66px] items-center rounded-full border border-slate-300 bg-slate-100 p-1 shadow-inner outline-none focus-visible:ring-4 focus-visible:ring-violet/30 active:scale-[.96] dark:border-[#444b59] dark:bg-[#252a34]"
          >
            <span className={`absolute top-1 grid h-8 w-8 place-items-center rounded-full shadow-md transition-all duration-300 ${dark ? "translate-x-6 bg-violet text-white" : "translate-x-0 bg-white text-amber-500"}`}>
              {dark ? <MoonIcon /> : <SunIcon />}
            </span>
            <span className={`ml-[7px] text-slate-400 transition-opacity ${dark ? "opacity-100" : "opacity-0"}`}><SunIcon /></span>
            <span className={`ml-auto mr-[7px] text-slate-500 transition-opacity dark:text-slate-400 ${dark ? "opacity-0" : "opacity-100"}`}><MoonIcon /></span>
          </button>
        </nav>
      </div>
    </header>
  );
}
