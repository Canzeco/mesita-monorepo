import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { ProfileClient } from "../ProfileClient";

// /me is the hub — identity header + DestTiles that Link to /me/<box>
// (MESITA-1789). A `?settings` query (or legacy `?tab=settings`) used to
// open the Settings sheet; it now forwards to the settings page.
//
// IN A ROUTE GROUP SO ITS FALLBACK IS ITS OWN (MESITA-2701). A loading.tsx
// beside me/page.tsx would also wrap every /me/<box>, and a navigation from
// outside Me (Social's "Connect Instagram" → /me/instagram) stops its
// prefetch at the first loading boundary, so it painted the hub's tiles
// before the Instagram page. (hub)/loading.tsx wraps this page only.

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
