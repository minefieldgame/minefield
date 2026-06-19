import { SNIPPET_LENGTHS } from "@/lib/scoring";

export default function AttemptTracker({ attempt }: { attempt: number }) {
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between text-xs font-bold uppercase tracking-[.16em] text-slate-500 dark:text-slate-300">
        <span>Clip {Math.min(attempt + 1, 7)} of 7</span>
        <span>{SNIPPET_LENGTHS[Math.min(attempt, 6)]} sec</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {SNIPPET_LENGTHS.map((_, index) => (
          <div
            key={index}
            className={`h-2.5 rounded-full border transition-colors ${
              index < attempt
                ? "border-slate-300 bg-slate-300 dark:border-slate-600 dark:bg-slate-600"
                : index === attempt
                  ? "border-coral bg-coral shadow-[0_0_10px_rgba(240,100,73,.28)] dark:border-[#ff765c] dark:bg-[#ff765c] dark:shadow-[0_0_14px_rgba(255,118,92,.38)]"
                  : "border-slate-200 bg-slate-100 dark:border-[#3a404d] dark:bg-[#292e38]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
