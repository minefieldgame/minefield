import ReviewPageClient from "@/components/ReviewPageClient";

export default async function ReviewPage({
  searchParams
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  return <ReviewPageClient requestedDate={date} />;
}
