import { redirect } from "next/navigation";

import { MeScreen } from "@/components/consumer/me/MeScreen";
import { FavoritesPage } from "@/components/consumer/saved/FavoritesPage";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// /me/favorites — Me › Favorites (MESITA-2565), in Me's frame. /me/saved and
// /saved forward here; a held link to the old Reservations tab
// (`?tab=reservations`) arrives with its query and goes on to
// /me/reservations.
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tab } = await searchParams;
  if (tab === "reservations") redirect(CONSUMER_ROUTES.mePages.reservations);
  return (
    <MeScreen title="Favorites" flush>
      <FavoritesPage />
    </MeScreen>
  );
}
