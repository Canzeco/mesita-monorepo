import { loadPlaceOrLeave } from "@/lib/load-place";
import { OfferTicketBody } from "@/components/consumer/OfferTicketBody";

export const dynamic = "force-dynamic";

// A VOUCHER'S TICKET (MESITA-4630, Pato: "the ticket must be full page and
// have a similar structure to the ticket of visit, with an X at the top
// right"): a row on Offers pushes here. A full page like Reserve, never
// intercepted (@modal has no (.)place/[id]/offers/[voucher]).
export default async function PlaceOfferTicketPage({
  params,
}: {
  params: Promise<{ id: string; voucher: string }>;
}) {
  const { id, voucher } = await params;
  const place = await loadPlaceOrLeave(id);
  return <OfferTicketBody place={place} voucher={decodeURIComponent(voucher)} />;
}
