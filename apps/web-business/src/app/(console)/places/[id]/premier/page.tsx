import { getPremier } from "@/lib/business-api";
import { PremierPanel } from "./PremierPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Premier" };

// Premier (MESITA-3103) is one table since MESITA-3638: the level, the three
// plans and the Upgrade as rows of one card (PremierPanel). Billing folded in
// before (MESITA-3620, Pato: "move Billing to Premier. You don't save cards
// in the app ... its saved in Stripe checkout"): the plans' Stripe Checkout
// returns here. No saved cards, charges or schedule: Stripe Checkout and its
// receipts hold those.
// The read is business-web-get-premier; with `?boost=<session>` it first
// settles the caller's own Checkout; `?plan=<tier>` is a plan a Keep link picked.
export default async function PremierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ boost?: string; plan?: string }>;
}) {
  const { id } = await params;
  const { boost, plan } = await searchParams;
  const picked = plan === "boost_2x" || plan === "boost_5x" ? plan : null;
  const res = await getPremier(id, boost ?? null);
  return (
    <div className="pb-8">
      <PremierPanel placeId={id} initial={res.ok ? res.data : null} loadError={res.ok ? null : res.error} picked={picked} />
    </div>
  );
}
