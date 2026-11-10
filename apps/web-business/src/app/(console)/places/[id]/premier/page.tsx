import { getPremier } from "@/lib/business-api";
import { PlansCard } from "@/components/billing/PlansCard";
import { PremierPanel } from "./PremierPanel";
import { StopGuestPlan } from "./StopGuestPlan";

export const dynamic = "force-dynamic";
export const metadata = { title: "Premier" };

// Premier (MESITA-3103), with Billing folded in (MESITA-3620, Pato: "move
// Billing to Premier. You don't save cards in the app ... its saved in Stripe
// checkout"): the level card (MESITA-3606), a guest's plan to stop, then the
// plan boxes, whose Stripe Checkout returns here. No saved cards, charges or
// schedule: Stripe Checkout and its receipts hold those.
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
  const data = res.ok ? res.data : null;
  return (
    <div className="flex flex-col gap-6 pb-8">
      <PremierPanel data={data} loadError={res.ok ? null : res.error} />
      {data?.paid && !data.paid.by_you ? (
        <StopGuestPlan
          placeId={id}
          until={new Date(data.paid.ends_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        />
      ) : null}
      <PlansCard placeId={id} initial={data} picked={picked} />
    </div>
  );
}
