import { getBilling, getPremier } from "@/lib/business-api";
import { BillingPanel, type CardReturn } from "./BillingPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing" };

// Billing (Pato, MESITA-3160: "in manage do add the billing section"): what
// runs, what it costs and every charge (business-web-get-billing, MESITA-3166).
// Update card's Checkout comes back here with `?boost=<session>`, which
// business-web-get-premier settles first; its outcome is the line on top, so
// a cancelled Checkout never reads "Your card is saved."
export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ boost?: string }>;
}) {
  const { id } = await params;
  const { boost } = await searchParams;
  let returned: CardReturn = null;
  if (boost) {
    const settled = await getPremier(id, boost);
    const outcome = settled.ok ? settled.data.outcome : "pending";
    returned = outcome === "saved" ? "saved" : outcome === "pending" ? "pending" : "unchanged";
  }
  const billing = await getBilling(id);
  return (
    <div className="flex flex-col gap-4 pb-8">
      <BillingPanel placeId={id} billing={billing.ok ? billing.data : null} error={billing.ok ? null : billing.error} returned={returned} />
    </div>
  );
}
