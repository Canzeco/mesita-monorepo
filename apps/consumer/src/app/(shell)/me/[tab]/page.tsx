import { redirect } from "next/navigation";
import { ProfileClient, type ProfileTab } from "../../profile/ProfileClient";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

function profileTabFromSegment(seg: string): ProfileTab | null {
  if (seg === "plan") return "plan";
  if (seg === "settings") return "settings";
  return null;
}

export default async function MeTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab: tabSegment } = await params;
  const tab = profileTabFromSegment(tabSegment);
  if (!tab) redirect(CONSUMER_ROUTES.me.plan);
  return <ProfileClient initialTab={tab} />;
}
