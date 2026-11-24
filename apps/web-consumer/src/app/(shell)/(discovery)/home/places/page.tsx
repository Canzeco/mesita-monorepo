import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// HOME › PLACES — /home/places, the catalog (Pato, MESITA-2597: "we should
// have home/places and home/social"). The screen is drawn by ../layout.tsx,
// which keeps CatalogRails mounted across Places and Social so the chosen
// family, the pool and the scroll survive a trip to Social; this page only
// claims the address.
//
// HOME ALWAYS OPENS ON NEARBY (Pato, 2026-11-23, MESITA-4808: "always open
// in nearby"; MESITA-4758 drew Social, Nearby or Popular). Opening Home with
// no row asked (the bar's Home, any "go Home") is sent to ?row=near here, on
// the server, so a row left open before never comes back by itself. A chip
// tapped from Social, or Me's Saved, carries its own ?row and is kept.
export const dynamic = "force-dynamic";

export default async function HomePlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ row?: string; gone?: string | string[] }>;
}) {
  const { row, gone } = await searchParams;
  if (!row) {
    // A dead place's `?gone` rides along for PlaceGoneNotice (MESITA-4917).
    const q = new URLSearchParams({ row: "near" });
    if (typeof gone === "string" && gone) q.set("gone", gone);
    redirect(`${CONSUMER_ROUTES.home}?${q.toString()}`);
  }
  return null;
}
