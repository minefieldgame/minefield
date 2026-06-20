import type { ReactNode } from "react";

export default function MiniGameCard({
  number,
  title,
  subtitle,
  children
}: {
  number: number;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="theme-surface w-full rounded-[1.5rem] border p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-[#343a47]">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.2em] text-[#db4e36] dark:text-[#ff826a]">
            Game {number}
          </p>
          <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">{title}</h2>
        </div>
        <span className="max-w-[9rem] text-right text-[11px] font-semibold leading-4 text-slate-500 dark:text-slate-400">
          {subtitle}
        </span>
      </div>
      {children}
    </section>
  );
}
