import { getPremier } from "@/lib/business-api";
import { PremierPanel } from "./PremierPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Premier" };

// Premier (MESITA-3103): the place's paid visibility, run by the place. The
// read is business-web-get-premier; with `?boost=<session>` (Stripe Checkout's
// return) it first settles the caller's own payment.
export default async function PremierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ boost?: string }>;
}) {
  const { id } = await params;
  const { boost } = await searchParams;
  const res = await getPremier(id, boost ?? null);
  return <PremierPanel placeId={id} initial={res.ok ? res.data : null} loadError={res.ok ? null : res.error} />;
}
