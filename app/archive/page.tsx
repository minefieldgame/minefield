import Header from "@/components/Header";
import MinefieldArchive from "@/components/MinefieldArchive";

export default function ArchivePage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-xl px-4 pb-12">
        <p className="mt-7 text-xs font-black uppercase tracking-[.2em] text-[#db4e36] dark:text-[#ff826a]">Daily history</p>
        <h1 className="mb-6 mt-2 text-4xl font-black tracking-tight text-slate-950 dark:text-white">Minefield archive</h1>
        <MinefieldArchive />
      </main>
    </>
  );
}
