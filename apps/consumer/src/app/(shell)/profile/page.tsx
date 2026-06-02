import { redirect } from "next/navigation";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Thin server entry for /profile. The shell layout already runs the
// auth + onboarding gate and exposes the display name to TopBar, so
// this page no longer pre-fetches consumer identity — the inline
// avatar / name / subtitle block was removed (TopBar already shows
// the name in the center column + the class chip on the right) and
// nothing else on the surface needs the identity payload yet.

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
  redirect(`${CONSUMER_ROUTES.me.plan}${qs.toString() ? `?${qs.toString()}` : ""}`);
}
