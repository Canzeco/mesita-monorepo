import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// Legacy catch-all for the retired nested Me routes (/me/class, /me/settings,
// /me/plan, and any old segment). The Me surface is a single flat page now, so
// forward everything to /me — preserving the query string, which carried
// post-checkout / Instagram-verify success flags. `settings` maps to the
// Settings box via ?settings so that deep link still lands.
export default async function LegacyMeTabPage({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ tab }, sp] = await Promise.all([params, searchParams]);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
    if (Array.isArray(v)) v.forEach((item) => qs.append(k, item));
  }
  if (tab === "settings") qs.set("settings", "1");
  const query = qs.toString();
  redirect(`${CONSUMER_ROUTES.me}${query ? `?${query}` : ""}`);
}
