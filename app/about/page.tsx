import Header from "@/components/Header";

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
        <article className="theme-surface rounded-[2rem] border p-7 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[.2em] text-[#db4e36] dark:text-[#ff826a]">About</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 dark:text-white">A daily ritual of quick games.</h1>
          <div className="mt-6 space-y-4 leading-7 text-slate-600 dark:text-slate-300">
            <p>Minefield is a vertical feed of fast daily mini-games. Play one, see your result, then move straight into the next.</p>
            <p>The daily board follows Pacific Time and is deterministic, so everyone receives the same games. Progress, streaks, scores, and the archive stay in your browser.</p>
            <p>The first games are NeedleDrop, a Billboard song challenge, and Top 10, a category-ranking quiz. The architecture is designed to grow into a larger daily game ritual.</p>
            <p>Game data uses provider-based resolution with validation and clear failure states. Minefield never stores or redistributes audio files.</p>
          </div>
        </article>
      </main>
    </>
  );
}
