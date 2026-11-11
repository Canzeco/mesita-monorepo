import { redirect } from "next/navigation";
import { PayPage } from "@/components/consumer/pay/PayPage";
import { CONSUMER_ROUTES, isRouteId, payPlacePath, payReceiptPath, payTabPath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

// /pay — the bar's Pay tab (Home · Search · Pay · Activity · Me), its Pay
// half (MESITA-3698; /wallet is the other): the places the guest can pay at. Each money object has its own address under it
// (MESITA-3614). The shapes it had before arrive here and forward in one
// hop: the printed table QR (?place=), a Stripe card return
// (?payment=<id>&checkout=…, built by _shared/pay-card.ts) and an old bill
// reload (?tab=). A saved card's Stripe return from before MESITA-3698
// (?card=) forwards to /wallet, where the card is now shown.
export default async function Page({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const payment = one(sp.payment);
  if (isRouteId(payment)) {
    const checkout = one(sp.checkout);
    redirect(`${payReceiptPath(payment)}${checkout ? `?checkout=${encodeURIComponent(checkout)}` : ""}`);
  }
  const tab = one(sp.tab);
  if (isRouteId(tab)) redirect(payTabPath(tab));
  const place = one(sp.place);
  if (isRouteId(place)) redirect(payPlacePath(place));
  const card = one(sp.card);
  if (card) redirect(`${CONSUMER_ROUTES.wallet}?card=${encodeURIComponent(card)}`);
  return <PayPage />;
}
