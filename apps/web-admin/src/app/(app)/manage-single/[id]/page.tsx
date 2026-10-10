import { redirect } from "next/navigation";
import { withQuery } from "@/lib/console-routes";
import { placeTabHref } from "@/lib/place-tabs";

// The bare place address forwards onto Profile. It used to catch Stripe's
// stored `?connect=` return for Payments' setup; Payments left with the
// Second Stage (MESITA-2088).
export const dynamic = "force-dynamic";

export default async function AdminPlaceRootPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  redirect(withQuery(placeTabHref(id, "profile"), sp));
}
