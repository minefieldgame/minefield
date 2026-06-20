import BrandLogo from "@/components/BrandLogo";

export default function LoadingState() {
  return (
    <div className="theme-surface mx-auto mt-10 max-w-md rounded-[2rem] border p-9 text-center">
      <div className="relative mx-auto mb-6 grid h-20 w-20 place-items-center">
        <BrandLogo className="h-16 w-auto object-contain drop-shadow-md" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-coral" />
      </div>
      <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">Dropping the needle…</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600 dark:text-slate-300">
        Finding today’s Billboard time capsule.
      </p>
    </div>
  );
}
