import { redirect } from "next/navigation";
import { ProfileClient, type ProfileTab } from "../../profile/ProfileClient";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

function profileTabFromSegment(seg: string): ProfileTab | null {
  if (seg === "class") return "class";
  if (seg === "settings") return "settings";
  return null;
}

export default async function MeTabPage({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tab: tabSegment } = await params;
  const tab = profileTabFromSegment(tabSegment);
  if (!tab) {
    // Legacy /me/plan (and any unknown segment) → /me/class. The plan
    // segment carried post-checkout / Instagram-verify success queries, so
    // forward the query string with the redirect.
    const sp = await searchParams;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === "string") qs.set(k, v);
      if (Array.isArray(v)) v.forEach((item) => qs.append(k, item));
    }
    redirect(
      `${CONSUMER_ROUTES.me.class}${qs.toString() ? `?${qs.toString()}` : ""}`,
    );
  }
  return <ProfileClient initialTab={tab} />;
}
