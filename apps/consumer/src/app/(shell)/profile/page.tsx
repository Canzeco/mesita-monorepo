import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Thin server entry for /profile — forwards to /me/class. The Me surface
// (ProfileClient) owns the identity hero, class, and invite affordance, so
// this page pre-fetches nothing itself.

export const dynamic = "force-dynamic";

export default async function ConsumerProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") qs.set(k, v);
    if (Array.isArray(v)) v.forEach((item) => qs.append(k, item));
  }
  redirect(
    `${CONSUMER_ROUTES.me.class}${qs.toString() ? `?${qs.toString()}` : ""}`,
  );
}
