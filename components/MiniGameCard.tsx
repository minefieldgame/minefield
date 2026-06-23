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
    <section className="theme-surface min-w-0 w-full overflow-hidden rounded-[1.35rem] border p-3.5 sm:rounded-[1.5rem] sm:p-5">
      <div className="mb-3 min-w-0 border-b border-slate-200 pb-2.5 dark:border-[#343a47] sm:pb-3">
        <p className="text-[11px] font-black uppercase tracking-[.2em] text-[#db4e36] dark:text-[#ff826a]">
          Game {number}
        </p>
        <h2 className="break-words text-lg font-black tracking-tight text-slate-950 dark:text-white sm:text-xl">{title}</h2>
        <span className="mt-1 block break-words text-[13px] font-semibold leading-5 text-slate-500 dark:text-slate-300 sm:text-sm">
          {subtitle}
        </span>
      </div>
      {children}
    </section>
  );
}
