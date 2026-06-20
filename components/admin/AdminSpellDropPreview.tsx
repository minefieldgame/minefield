"use client";

import type { AdminSpellDropPreview as Preview } from "@/types/admin";

export default function AdminSpellDropPreview({ preview }: { preview: Preview }) {
  const rows = [
    ["Selected word", preview.word],
    ["Accepted spelling", preview.acceptedSpelling],
    ["Date seed", preview.dateSeed],
    ["Replay limit", preview.replayLimit],
    ["Curated word count", preview.wordCount]
  ];
  return (
    <section className="theme-surface rounded-[2rem] border p-5 sm:p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#db4e36] dark:text-[#ff826a]">Game diagnostics</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">SpellDrop</h2>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">Ready</span>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="theme-raised rounded-xl border p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-1 break-words text-sm font-bold text-slate-950 dark:text-white">{value}</p>
          </div>
        ))}
      </div>
      <button
        onClick={() => {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(preview.word);
          utterance.rate = 0.78;
          window.speechSynthesis.speak(utterance);
        }}
        className="mt-4 rounded-xl bg-violet px-5 py-3 text-sm font-extrabold text-white dark:bg-[#7569e5]"
      >
        Test spoken word
      </button>
    </section>
  );
}
