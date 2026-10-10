import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { ProfileClient } from "./ProfileClient";

// /me is the hub — identity header + DestTiles that Link to /me/<box>
// (MESITA-1789). A `?settings` query (or legacy `?tab=settings`) used to
// open the Settings sheet; it now forwards to the settings page.

export const dynamic = "force-dynamic";

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  if (sp.settings != null || sp.tab === "settings") {
    redirect(CONSUMER_ROUTES.mePages.settings);
  }
  return <ProfileClient />;
}
