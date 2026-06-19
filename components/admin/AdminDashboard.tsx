"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { adminGameRegistry } from "@/components/admin/adminGameRegistry";
import { ADMIN_SESSION_KEY } from "@/lib/adminAuth";
import { hashString } from "@/lib/dailySeed";
import { getDailyGameDate, getPacificToday } from "@/lib/date";
import type { AdminPreviewResponse } from "@/types/admin";

function shiftDate(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function randomDate() {
  const start = Date.parse("1960-01-01T12:00:00Z");
  const end = Date.parse(`${getDailyGameDate()}T12:00:00Z`);
  const value = start + Math.floor(Math.random() * (end - start + 1));
  return new Date(value).toISOString().slice(0, 10);
}

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Access denied.");
      }
      sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
      onSuccess();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Access denied.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <section className="theme-surface w-full max-w-sm rounded-[2rem] border p-7">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#202128] text-2xl text-white dark:bg-violet">◆</div>
        <p className="mt-6 text-center text-xs font-black uppercase tracking-[.2em] text-[#db4e36] dark:text-[#ff826a]">Restricted access</p>
        <h1 className="mt-2 text-center text-3xl font-black tracking-tight text-slate-950 dark:text-white">Minefield Admin</h1>
        <p className="mx-auto mt-2 max-w-xs text-center text-sm leading-6 text-slate-500 dark:text-slate-300">Enter the owner password to open puzzle diagnostics.</p>
        <form onSubmit={submit} className="mt-6">
          <label htmlFor="admin-password" className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">Password</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="mt-2 h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 font-semibold text-slate-950 outline-none focus:border-violet focus:ring-4 focus:ring-violet/15 dark:border-[#454c5a] dark:bg-[#252a34] dark:text-white"
          />
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-600 dark:text-red-300">{error}</p>}
          <button disabled={busy || !password} className="mt-4 h-14 w-full rounded-2xl bg-violet font-extrabold text-white shadow-lg shadow-violet/20 disabled:opacity-40 dark:bg-[#7569e5]">
            {busy ? "Checking…" : "Unlock admin"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function AdminDashboard({ environment }: { environment: string }) {
  const today = getDailyGameDate();
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [selectedDate, setSelectedDate] = useState(today);
  const [preview, setPreview] = useState<AdminPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dark, setDark] = useState(false);
  const [topTenRetry, setTopTenRetry] = useState(0);

  const generate = useCallback(async (
    date = selectedDate,
    options: { retryTopTen?: boolean } = {}
  ) => {
    setSelectedDate(date);
    setLoading(true);
    setError("");
    const retry = options.retryTopTen ? topTenRetry + 1 : 0;
    setTopTenRetry(retry);
    try {
      const response = await fetch(
        `/api/admin/preview?date=${date}&topTenRetry=${retry}&t=${Date.now()}`,
        {
        cache: "no-store"
        }
      );
      if (response.status === 401) {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        setAuthenticated(false);
        throw new Error("Your admin session expired.");
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Preview generation failed.");
      setPreview(payload as AdminPreviewResponse);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Preview generation failed.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, topTenRetry]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("needledrop:theme");
    const enabled = savedTheme ? savedTheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(enabled);
    document.documentElement.classList.toggle("dark", enabled);

    const hasSession = sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
    if (!hasSession) {
      setChecking(false);
      return;
    }
    fetch("/api/admin/auth")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.authenticated) setAuthenticated(true);
        else sessionStorage.removeItem(ADMIN_SESSION_KEY);
      })
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (authenticated && !preview) generate(today);
  }, [authenticated, generate, preview, today]);

  async function logout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setAuthenticated(false);
    setPreview(null);
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("needledrop:theme", next ? "dark" : "light");
  }

  if (checking) {
    return <main className="grid min-h-screen place-items-center text-sm font-bold text-slate-500 dark:text-slate-300">Checking admin session…</main>;
  }
  if (!authenticated) return <AdminLogin onSuccess={() => setAuthenticated(true)} />;

  const pacific = getPacificToday();
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-white/[.08] dark:bg-[#111318]/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <div>
            <h1 className="text-xl font-black text-slate-950 dark:text-white">Minefield Admin</h1>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{environment} · Pacific {pacific.dateKey}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleTheme} aria-label="Toggle admin theme" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-300 bg-white dark:border-[#454c5a] dark:bg-[#292e38]">{dark ? "☀" : "☾"}</button>
            <button onClick={logout} className="rounded-xl border border-slate-300 bg-white px-4 text-sm font-extrabold text-slate-700 dark:border-[#454c5a] dark:bg-[#292e38] dark:text-white">Logout</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-7 pb-16">
        <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="test-date" className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">Active test date</label>
              <input id="test-date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 font-bold text-slate-950 dark:border-[#454c5a] dark:bg-[#252a34] dark:text-white" />
            </div>
            <button onClick={() => generate()} disabled={loading} className="h-12 rounded-xl bg-violet px-6 font-extrabold text-white disabled:opacity-50 dark:bg-[#7569e5]">{loading ? "Generating…" : "Generate"}</button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            <button onClick={() => setSelectedDate(shiftDate(selectedDate, -1))} className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-bold dark:bg-[#292e38]">Previous Day</button>
            <button onClick={() => setSelectedDate(shiftDate(selectedDate, 1))} className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-bold dark:bg-[#292e38]">Next Day</button>
            <button onClick={() => setSelectedDate(today)} className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-bold dark:bg-[#292e38]">Today</button>
            <button onClick={() => setSelectedDate(shiftDate(today, 1))} className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-bold dark:bg-[#292e38]">Tomorrow</button>
            <button onClick={() => generate(shiftDate(today, 1))} className="rounded-xl bg-coral px-3 py-2.5 text-sm font-bold text-white">Preview Tomorrow</button>
            <button onClick={() => { const date = randomDate(); generate(date); }} className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-bold dark:bg-[#292e38]">Random Day</button>
            <button onClick={() => generate(selectedDate)} className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-bold dark:bg-[#292e38]">Regenerate All</button>
          </div>
        </section>

        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">{error}</div>}

        {preview && (
          <>
            <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
              <h2 className="text-lg font-black text-slate-950 dark:text-white">Daily seed debugging</h2>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  ["Selected date", preview.date],
                  ["Pacific date", preview.pacificDate],
                  ["Daily seed", preview.dailySeed],
                  ["Seed hash", preview.seedHash],
                  ["Generated", new Date(preview.generatedAt).toLocaleString()]
                ].map(([label, value]) => (
                  <div key={label} className="theme-raised rounded-xl border p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-1 break-words text-sm font-bold text-slate-950 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Minefield seed input: <code>minefield:{preview.date}</code> · hash check: {hashString(`minefield:${preview.date}`)}</p>
            </section>

            {adminGameRegistry.map(({ gameId, AdminPreviewComponent }) => (
              <AdminPreviewComponent
                key={gameId}
                data={preview}
                onRegenerate={() => generate(preview.date)}
                onRetryTopTen={() => generate(preview.date, { retryTopTen: true })}
              />
            ))}

            <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
              <h2 className="text-xl font-black text-slate-950 dark:text-white">Future game previews</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Chrono, Higher, Closer, Fake Fact, Breedle, GeoPin, Ladder, and Minefield can register an admin preview through the shared module registry.</p>
            </section>
          </>
        )}
      </main>
    </>
  );
}
