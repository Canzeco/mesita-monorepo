import { SavedPage } from "@/components/consumer/saved/SavedPage";
import { savedTabFrom } from "@/lib/saved-tabs";

// /saved — the bar's Saved tab (MESITA-2521): Favorites | Reservations.
// `?tab=reservations` opens the second; /bookings forwards there.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return <SavedPage initialTab={savedTabFrom(sp.tab)} />;
}
