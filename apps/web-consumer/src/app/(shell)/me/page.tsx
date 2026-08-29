import { ProfileClient } from "./ProfileClient";

// /me is the whole Me surface — identity hero + modular boxes (Class,
// Settings, …) that open as modals. No nested tab routes. A `?settings`
// query (or legacy `?tab=settings`) opens the Settings box on arrival, and
// `?cards` reopens Cards — that is the return trip from Stripe's hosted
// setup page (consumer-web-add-card sends the guest to /me?cards=added).
// Both are seeded as props so nothing opens a sheet from an effect.
export const dynamic = "force-dynamic";

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const openSettings = sp.settings != null || sp.tab === "settings";
  const openCards = sp.cards != null;
  return <ProfileClient openSettings={openSettings} openCards={openCards} />;
}
