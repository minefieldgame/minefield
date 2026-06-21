import ReviewPageClient from "@/components/ReviewPageClient";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_VALUE } from "@/lib/adminAuth";

export default async function ReviewPage({
  searchParams
}: {
  searchParams: Promise<{ date?: string; mode?: string }>;
}) {
  const { date, mode } = await searchParams;
  const adminPreview = mode === "admin-preview";
  if (adminPreview) {
    const cookieStore = await cookies();
    if (cookieStore.get(ADMIN_COOKIE_NAME)?.value !== ADMIN_SESSION_VALUE) {
      return <ReviewPageClient accessDenied />;
    }
  }
  return <ReviewPageClient requestedDate={date} mode={adminPreview ? "admin-preview" : "daily"} />;
}
