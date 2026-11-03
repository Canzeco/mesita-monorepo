import { getBilling, getPremier } from "@/lib/business-api";
import { BillingPanel } from "./BillingPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing" };

// Billing (Pato, MESITA-3160: "in manage do add the billing section"): the
// place's plan, the payer's card and every charge (business-web-get-billing).
// Update card's Checkout comes back here with `?boost=<session>`, which
// business-web-get-premier settles first so the new card shows.
export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ boost?: string }>;
}) {
  const { id } = await params;
  const { boost } = await searchParams;
  if (boost) await getPremier(id, boost);
  const billing = await getBilling(id);
  return (
    <div className="flex flex-col gap-4 pb-8">
      <BillingPanel placeId={id} billing={billing.ok ? billing.data : null} error={billing.ok ? null : billing.error} saved={!!boost} />
    </div>
  );
}
