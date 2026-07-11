import { ProfileClient } from "../profile/ProfileClient";

// /me is the whole Me surface — identity hero + modular boxes (Class,
// Settings, …) that open as modals. No nested tab routes. A `?settings`
// query (or legacy `?tab=settings`) opens the Settings box on arrival.
export const dynamic = "force-dynamic";

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const openSettings = sp.settings != null || sp.tab === "settings";
  return <ProfileClient openSettings={openSettings} />;
}
