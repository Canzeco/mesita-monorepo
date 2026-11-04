import { getBilling, getPremier } from "@/lib/business-api";
import { BillingPanel, type CardReturn } from "./BillingPanel";
import { PlansCard } from "@/components/billing/PlansCard";
import { StopGuestPlan } from "./StopGuestPlan";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing" };

// Billing (Pato, MESITA-3160: "in manage do add the billing section"): what
// runs, what it costs and every charge (business-web-get-billing, MESITA-3166).
// Update card's Checkout comes back here with `?boost=<session>`, which
// business-web-get-premier settles first; its outcome is the line on top, so
// a cancelled Checkout never reads "Your card is saved." Since MESITA-3173 it
// also lists the plans (Free · Pro · Max, MESITA-3174), whose Checkout
// returns here too; `?plan=<tier>` is the plan the Keep button picked.
export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ boost?: string; plan?: string }>;
}) {
  const { id } = await params;
  const { boost, plan } = await searchParams;
  const picked = plan === "boost_2x" || plan === "boost_5x" ? plan : null;
  // Settle the Checkout first (buying or Update card), then read Billing.
  const premier = await getPremier(id, boost ?? null);
  const outcome = premier.ok ? premier.data.outcome : null;
  // A bought plan's outcome is the Plans card's line; only a card return is here.
  const returned: CardReturn = boost && outcome === "saved" ? "saved" : null;
  const billing = await getBilling(id);
  return (
    <div className="flex flex-col gap-4 pb-8">
      {premier.ok && premier.data.paid && !premier.data.paid.by_you ? (
        <StopGuestPlan
          placeId={id}
          until={new Date(premier.data.paid.ends_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        />
      ) : null}
      <BillingPanel placeId={id} billing={billing.ok ? billing.data : null} error={billing.ok ? null : billing.error} returned={returned}
        plans={<PlansCard placeId={id} initial={premier.ok ? premier.data : null} picked={picked} />}
      />
    </div>
  );
}
