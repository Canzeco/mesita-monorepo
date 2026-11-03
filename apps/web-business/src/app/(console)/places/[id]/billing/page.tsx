import { redirect } from "next/navigation";

// Billing is a section of Settings since MESITA-3136 (Pato: "for the moment
// billing inside settings"). Old links, and a Checkout return carrying
// `?boost=<session>`, land there with the session kept.
export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ boost?: string }>;
}) {
  const { id } = await params;
  const { boost } = await searchParams;
  redirect(`/places/${encodeURIComponent(id)}/settings${boost ? `?boost=${encodeURIComponent(boost)}` : ""}#billing`);
}
