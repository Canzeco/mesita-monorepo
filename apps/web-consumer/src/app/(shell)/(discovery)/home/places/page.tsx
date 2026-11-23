import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// HOME › PLACES — /home/places, the catalog (Pato, MESITA-2597: "we should
// have home/places and home/social"). The screen is drawn by ../layout.tsx,
// which keeps CatalogRails mounted across Places and Social so the chosen
// family, the pool and the scroll survive a trip to Social; this page only
// claims the address.
//
// HOME OPENS ON A DRAW (Pato, 2026-11-23, MESITA-4758: "when you open home
// page: 25% chance it opens in social, 50% nearby, 25% popular"). Opening
// Home with no row asked (the bar's Home, any "go Home") is drawn here, on
// the server, so the first paint already shows the row: 25% Social's
// address, 50% ?row=near, 25% ?row=all (Popular's key). A chip tapped from
// Social comes back with its own ?row and is never redrawn.
export const dynamic = "force-dynamic";

export default async function HomePlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ row?: string }>;
}) {
  const { row } = await searchParams;
  if (!row) {
    const r = Math.random();
    if (r < 0.25) redirect(CONSUMER_ROUTES.homeSocial);
    redirect(`${CONSUMER_ROUTES.home}?row=${r < 0.75 ? "near" : "all"}`);
  }
  return null;
}
