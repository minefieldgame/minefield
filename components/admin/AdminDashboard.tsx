"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { adminGameRegistry, retiredAdminGameRegistry } from "@/components/admin/adminGameRegistry";
import { ADMIN_SESSION_KEY } from "@/lib/adminAuth";
import { INVENTORY_METRIC_LABELS, type InventoryMetrics } from "@/lib/content/inventoryMetrics";
import { createSeededRandom, hashString } from "@/lib/dailySeed";
import { getPacificDateKey, getPacificToday } from "@/lib/date";
import type { AdminPreviewResponse } from "@/types/admin";

const inventoryMetricKeys: Array<keyof InventoryMetrics> = [
  "discoveredUnique",
  "providerResponsesExamined",
  "technicallyValidUnique",
  "qualityApproved",
  "playableEligible",
  "unusedEligible",
  "previouslyUsed",
  "cooldown",
  "pendingExternalProviderData",
  "invalid",
  "rejectedQuality",
  "duplicateAliasesCollapsed"
];

function statusTone(status: string) {
  if (/Healthy|Ready|Cached|Generated/i.test(status)) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200";
  if (/informational|snapshot/i.test(status)) return "bg-sky-100 text-sky-800 dark:bg-sky-400/10 dark:text-sky-200";
  if (/Low|warning/i.test(status)) return "bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200";
  return "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-200";
}

function shiftDate(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function randomDate() {
  const today = Date.parse(`${getPacificDateKey()}T12:00:00Z`);
  const start = today + 86_400_000;
  const end = today + 730 * 86_400_000;
  const random = createSeededRandom(`admin-random-day:${Date.now()}`);
  const value = start + random.int(0, end - start);
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
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#202128] text-lg font-black text-white dark:bg-violet">MF</div>
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
            {busy ? "Checking..." : "Unlock admin"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function AdminDashboard({ environment }: { environment: string }) {
  const today = getPacificDateKey();
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [selectedDate, setSelectedDate] = useState(today);
  const [preview, setPreview] = useState<AdminPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dark, setDark] = useState(false);
  const [topTenRetry, setTopTenRetry] = useState(0);
  const [replenishing, setReplenishing] = useState(false);
  const [replenishResult, setReplenishResult] = useState("");

  const generate = useCallback(async (
    date = selectedDate,
    options: { retryTopTen?: boolean; forceAll?: boolean } = {}
  ) => {
    setSelectedDate(date);
    setLoading(true);
    setError("");
    const retry = options.retryTopTen ? topTenRetry + 1 : 0;
    setTopTenRetry(retry);
    try {
      const response = await fetch(
        `/api/admin/preview?date=${date}&topTenRetry=${retry}&force=${options.forceAll ? "1" : ""}&t=${Date.now()}`,
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

  async function replenishInventories() {
    setReplenishing(true);
    setReplenishResult("");
    try {
      const response = await fetch("/api/admin/content-inventory", { method: "POST", cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Inventory replenishment failed.");
      setReplenishResult(payload.results.map((item: { gameId: string; status: string; generated: number; validated: number }) => `${item.gameId}: ${item.status} (${item.generated} generated, ${item.validated} validated)`).join(" | "));
      await generate(selectedDate);
    } catch (reason) {
      setReplenishResult(reason instanceof Error ? reason.message : "Inventory replenishment failed.");
    } finally {
      setReplenishing(false);
    }
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("needledrop:theme", next ? "dark" : "light");
  }

  if (checking) {
    return <main className="grid min-h-screen place-items-center text-sm font-bold text-slate-500 dark:text-slate-300">Checking admin session...</main>;
  }
  if (!authenticated) return <AdminLogin onSuccess={() => setAuthenticated(true)} />;

  const pacific = getPacificToday();
  const previewPath = `/play?date=${selectedDate}&mode=admin-preview`;
  async function copyPreviewUrl() {
    await navigator.clipboard.writeText(`${window.location.origin}${previewPath}`);
  }
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-white/[.08] dark:bg-[#111318]/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <div>
            <h1 className="text-xl font-black text-slate-950 dark:text-white">Minefield Admin</h1>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{environment} / Pacific {pacific.dateKey}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleTheme} aria-label="Toggle admin theme" className="grid h-10 min-w-14 place-items-center rounded-xl border border-slate-300 bg-white px-2 text-xs font-black dark:border-[#454c5a] dark:bg-[#292e38]">{dark ? "Light" : "Dark"}</button>
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
            <button onClick={() => generate()} disabled={loading} className="h-12 rounded-xl bg-violet px-6 font-extrabold text-white disabled:opacity-50 dark:bg-[#7569e5]">{loading ? "Generating..." : "Generate"}</button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            <button onClick={() => setSelectedDate(shiftDate(selectedDate, -1))} className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-bold dark:bg-[#292e38]">Previous Day</button>
            <button onClick={() => setSelectedDate(shiftDate(selectedDate, 1))} className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-bold dark:bg-[#292e38]">Next Day</button>
            <button onClick={() => setSelectedDate(today)} className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-bold dark:bg-[#292e38]">Today</button>
            <button onClick={() => setSelectedDate(shiftDate(today, 1))} className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-bold dark:bg-[#292e38]">Tomorrow</button>
            <button onClick={() => generate(shiftDate(today, 1))} className="rounded-xl bg-coral px-3 py-2.5 text-sm font-bold text-white">Preview Tomorrow</button>
            <button onClick={() => { const date = randomDate(); generate(date); }} className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-bold dark:bg-[#292e38]">Random Day</button>
            <button onClick={() => generate(selectedDate, { forceAll: true })} className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-bold dark:bg-[#292e38]">Regenerate All</button>
          </div>
          <button onClick={replenishInventories} disabled={replenishing} className="mt-3 h-12 w-full rounded-xl bg-indigo-600 px-4 text-sm font-extrabold text-white disabled:opacity-50">
            {replenishing ? "Replenishing content inventories..." : "Replenish Content Inventories"}
          </button>
          {replenishResult && <p className="mt-2 rounded-xl bg-slate-100 p-3 text-xs font-bold dark:bg-[#292e38]">{replenishResult}</p>}
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <a href={previewPath} className="flex h-12 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-extrabold text-white">
              Play this date
            </a>
            <button onClick={copyPreviewUrl} className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-extrabold text-slate-700 dark:border-[#454c5a] dark:bg-[#292e38] dark:text-white">
              Copy direct preview URL
            </button>
            <button onClick={() => generate(selectedDate)} disabled={loading} className="h-12 rounded-xl bg-slate-100 px-4 text-sm font-extrabold dark:bg-[#292e38]">
              Preview data
            </button>
          </div>
        </section>

        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">{error}</div>}

        {preview && (
          <>
            <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
              <h2 className="text-lg font-black text-slate-950 dark:text-white">Content health</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                Inventory health describes the reusable pool. Selected-date status describes only this preview request.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {preview.contentHealth.map((item) => (
                  <article key={item.gameId} className="theme-raised rounded-2xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-black">{item.label}</h3>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${statusTone(item.inventoryHealthStatus)}`}>
                          {item.gameId === "needledrop" ? "Selected-date inventory sample" : "Inventory"}: {item.inventoryHealthStatus}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${statusTone(item.selectedDateStatus)}`}>
                          Selected date: {item.selectedDateStatus}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{item.generationArchitecture}</p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Metric scope: {item.metricsScope}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:grid-cols-4">
                      {inventoryMetricKeys.map((metricKey) => {
                        const definition = INVENTORY_METRIC_LABELS[metricKey];
                        return (
                          <div key={metricKey} title={definition.description} className="rounded-lg bg-white/60 p-2 dark:bg-black/10">
                            <p className="text-[9px] font-black uppercase text-slate-500">{definition.label}</p>
                            <p className="font-black">{item.metrics[metricKey]}</p>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">Cooldown window: {item.cooldownDays} days | Target: {item.target} | Replenish below: {item.replenishBelow}</p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Current request: {item.candidatesGeneratedCurrentRequest} generated | {item.candidatesRejectedCurrentRequest} rejected | {item.apiCalls} API calls | DynamoDB R/W {item.dynamoDbReads}/{item.dynamoDbWrites} | {item.generationDurationMs} ms</p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Selected: {item.selectedCandidate || "None"} | Source: {item.sourceStrategy}</p>
                    {Object.keys(item.distributions).length > 0 && (
                      <details className="mt-3 rounded-lg border border-slate-200 dark:border-white/10">
                        <summary className="cursor-pointer px-3 py-2 text-xs font-extrabold">Category and quality distributions</summary>
                        <pre className="max-h-52 overflow-auto border-t border-slate-200 p-3 text-[10px] dark:border-white/10">{JSON.stringify(item.distributions, null, 2)}</pre>
                      </details>
                    )}
                    {item.actionableFailureReason && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs font-bold text-red-700 dark:bg-red-400/10 dark:text-red-300">{item.actionableFailureReason}</p>}
                  </article>
                ))}
              </div>
            </section>
            <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
              <h2 className="text-lg font-black text-slate-950 dark:text-white">Daily seed debugging</h2>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  ["Selected date", preview.date],
                  ["Pacific date", preview.pacificDate],
                  ["Master seed", preview.masterSeed],
                  ["Board hash", preview.dailyBoard.boardHash],
                  ["Persistence", `${preview.persistenceProvider.provider} (${preview.persistenceProvider.durableAcrossDeployments ? "durable" : "deterministic fallback"})`],
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
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Master seed input: <code>minefield:{preview.date}:v1</code> | legacy hash check: {hashString(`minefield:${preview.date}`)}</p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{preview.persistenceProvider.note}</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Game</th>
                      <th className="py-2 pr-3">Version</th>
                      <th className="py-2 pr-3">Seed</th>
                      <th className="py-2 pr-3">Cache key</th>
                      <th className="py-2 pr-3">Puzzle hash</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Duplicate check</th>
                      <th className="py-2 pr-3">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.dailyBoard.games.map((game) => (
                      <tr key={game.gameId} className="border-t border-slate-200 dark:border-white/10">
                        <td className="py-2 pr-3 font-black">{game.gameId}</td>
                        <td className="py-2 pr-3 font-bold">{game.gameVersion}</td>
                        <td className="py-2 pr-3 font-mono">{game.gameSeed}</td>
                        <td className="py-2 pr-3 font-mono">{game.cacheKey}</td>
                        <td className="py-2 pr-3 font-mono">{game.puzzleHash}</td>
                        <td className={`py-2 pr-3 font-black ${game.status === "Failed" ? "text-red-600 dark:text-red-300" : game.status === "Low inventory warning" ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>{game.status}</td>
                        <td className={`py-2 pr-3 font-black ${game.duplicateCheck?.passed === false ? "text-red-600 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                          {game.status === "Failed" ? "Failed" : game.duplicateCheck?.passed === false ? "Warning" : "Passed"}
                          {game.duplicateCheck?.retryCount ? ` | ${game.duplicateCheck.retryCount} retries` : ""}
                        </td>
                        <td className="py-2 pr-3">{game.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {adminGameRegistry.map(({ gameId, AdminPreviewComponent }) => (
              <div key={gameId} className="space-y-2">
                <div className="flex flex-wrap justify-end gap-2">
                  <button onClick={() => generate(preview.date)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-extrabold dark:bg-[#292e38]">
                    Preview data
                  </button>
                  <a href={`/play?date=${preview.date}&mode=admin-preview`} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white">
                    Play this date
                  </a>
                  <button
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/play?date=${preview.date}&mode=admin-preview`)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-extrabold dark:border-[#454c5a] dark:bg-[#292e38]"
                  >
                    Copy direct preview URL
                  </button>
                </div>
                <AdminPreviewComponent
                  data={preview}
                  onRegenerate={() => generate(preview.date, { forceAll: true })}
                  onRetryTopTen={() => generate(preview.date, { retryTopTen: true })}
                />
              </div>
            ))}

            <section className="space-y-3 border-t border-slate-200 pt-5 dark:border-white/10">
              <div>
                <h2 className="text-lg font-black text-slate-950 dark:text-white">Retired / legacy</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Preserved for historical diagnostics only. Retired games are not generated, scored, replenished, or allowed to block the active daily board.
                </p>
              </div>
              {retiredAdminGameRegistry.map(({ gameId, AdminPreviewComponent }) => (
                <AdminPreviewComponent
                  key={gameId}
                  data={preview}
                  onRegenerate={() => generate(preview.date)}
                  onRetryTopTen={() => generate(preview.date)}
                />
              ))}
            </section>

          </>
        )}
      </main>
    </>
  );
}


