import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { ProfileClient } from "./ProfileClient";

// /me is the hub — identity hero + DestTiles that Link to /me/<box>
// (MESITA-1789). A `?settings` query (or legacy `?tab=settings`) used to
// open the Settings sheet; it now forwards to the settings page. `?cards`
// is Stripe's return from consumer-web-add-card and forwards to Wallet,
// where cards already render inline.

export const dynamic = "force-dynamic";

function firstString(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  if (sp.settings != null || sp.tab === "settings") {
    redirect(CONSUMER_ROUTES.mePages.settings);
  }
  if (sp.cards != null) {
    const cards = firstString(sp.cards) ?? "1";
    redirect(`${CONSUMER_ROUTES.newVisit.wallet}?cards=${encodeURIComponent(cards)}`);
  }
  return <ProfileClient />;
}
