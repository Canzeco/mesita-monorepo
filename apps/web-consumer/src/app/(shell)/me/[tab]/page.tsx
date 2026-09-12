import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// Catch-all for unknown /me/<segment> leftovers. Static folders
// (/me/class, /me/settings, /me/plan, …) win over this dynamic route.
// Anything else 308s onto the hub.

export default async function LegacyMeTabPage({
  searchParams,
}: {
  params: Promise<{ tab: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
    if (Array.isArray(v)) {
      for (const item of v) qs.append(k, item);
    }
  }
  const query = qs.toString();
  redirect(`${CONSUMER_ROUTES.me}${query ? `?${query}` : ""}`);
}
