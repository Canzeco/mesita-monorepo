import { loadPlaceOrLeave } from "@/lib/load-place";
import { PlaceReportPage } from "@/components/consumer/place-detail/ReportSheet";

export const dynamic = "force-dynamic";

// Report (MESITA-4111): a member page under the place. It was a sheet from
// More. A signed-out tap asks to sign in before this address opens.
export default async function PlaceReportRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const place = await loadPlaceOrLeave((await params).id);
  return <PlaceReportPage place={place} />;
}
