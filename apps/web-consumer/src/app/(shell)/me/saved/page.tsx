import { MeScreen } from "@/components/consumer/me/MeScreen";
import { SavedPage } from "@/components/consumer/saved/SavedPage";
import { savedTabFrom } from "@/lib/saved-tabs";

// /me/saved — Me › Saved (MESITA-2561): Favorites | Reservations. It was the
// bar's fourth tab at /saved (MESITA-2521) until Share took that slot; /saved,
// /bookings and every older list address forward here. `?tab=reservations`
// opens the second. It wears Me's frame, back and title, like every Me box.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <MeScreen title="Saved" flush>
      <SavedPage initialTab={savedTabFrom(sp.tab)} />
    </MeScreen>
  );
}
