import Link from "next/link";
import { cookies } from "next/headers";
import MinefieldFeed from "@/components/MinefieldFeed";
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_VALUE } from "@/lib/adminAuth";
import { getDailyGameDate } from "@/lib/date";

export default async function PlayPage({
  searchParams
}: {
  searchParams: Promise<{ date?: string; mode?: string }>;
}) {
  const { date: requestedDate, mode } = await searchParams;
  const cookieStore = await cookies();
  const authenticated = cookieStore.get(ADMIN_COOKIE_NAME)?.value === ADMIN_SESSION_VALUE;
  const adminPreview = mode === "admin-preview";
  if (!adminPreview || !authenticated) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <section className="theme-surface w-full max-w-sm rounded-3xl border p-7 text-center">
          <h1 className="text-2xl font-black text-slate-950 dark:text-white">Admin access required</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
            Historic board previews are only available from an authenticated admin session.
          </p>
          <Link href="/admin" className="mt-5 inline-flex rounded-xl bg-violet px-6 py-3 font-extrabold text-white">
            Open Admin
          </Link>
        </section>
      </main>
    );
  }
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : getDailyGameDate();
  return <MinefieldFeed dateOverride={date} mode="admin-preview" />;
}
