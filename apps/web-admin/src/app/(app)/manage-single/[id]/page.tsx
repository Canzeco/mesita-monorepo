import { redirect } from "next/navigation";
import { placePayHref, withQuery } from "@/lib/console-routes";
import { placeTabHref } from "@/lib/place-tabs";

// The bare place address forwards onto Profile — and alone catches Stripe's
// stored `?connect=` return, which lands on Payments' setup instead.
export const dynamic = "force-dynamic";

export default async function AdminPlaceRootPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (typeof sp.connect === "string") redirect(withQuery(placePayHref(id), sp));
  redirect(withQuery(placeTabHref(id, "profile"), sp));
}
