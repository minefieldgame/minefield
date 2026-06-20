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
      <div className="mb-3 border-b border-slate-200 pb-3 dark:border-[#343a47]">
        <p className="text-[11px] font-black uppercase tracking-[.2em] text-[#db4e36] dark:text-[#ff826a]">
          Game {number}
        </p>
        <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">{title}</h2>
        <span className="mt-1 block text-sm font-semibold leading-5 text-slate-500 dark:text-slate-300">
          {subtitle}
        </span>
      </div>
      {children}
    </section>
  );
}
