import { getBilling, getPremier } from "@/lib/business-api";
import { BillingPanel } from "./BillingPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing" };

// A place's Billing (Pato, MESITA-3128: "here the cards are saved"): its paid
// Premier, the card on it and every charge (business-web-get-billing). Update
// card's Checkout comes back here with `?boost=<session>`, which
// business-web-get-premier settles before the read.
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
  const res = await getBilling(id);
  return <BillingPanel placeId={id} billing={res.ok ? res.data : null} error={res.ok ? null : res.error} saved={!!boost} />;
}
