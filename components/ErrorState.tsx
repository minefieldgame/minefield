export default function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="theme-surface mx-auto mt-10 max-w-md rounded-[2rem] border p-9 text-center">
      <div className="mb-4 text-4xl">📻</div>
      <h2 className="text-xl font-black text-slate-950 dark:text-white">A little radio silence</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600 dark:text-slate-300">{message}</p>
      <button
        onClick={retry}
        className="mt-6 min-h-12 rounded-full bg-[#202128] px-7 py-3 font-bold text-white shadow-md hover:bg-[#30323a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet/25 active:scale-[.97] dark:bg-violet dark:hover:bg-[#7569e5]"
      >
        Try again
      </button>
    </div>
  );
}
