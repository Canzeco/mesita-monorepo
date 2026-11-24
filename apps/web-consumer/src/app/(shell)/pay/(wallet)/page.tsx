import { redirect } from "next/navigation";
import { PayPage } from "@/components/consumer/pay/PayPage";
import { CONSUMER_ROUTES, isRouteId, payCodePath, payReceiptPath, payBillPath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

// /pay — the bar's Pay tab, Pay and Wallet on one page (MESITA-4199): the
// payment in progress or the places the guest can pay at, then what they pay
// with (/wallet forwards here). Each money object has its own address under
// it (MESITA-3614). The shapes it had before arrive here and forward in one
// hop: the printed table QR (?place=), an old Stripe card return
// (?payment=<id>&checkout=…; a bill has no card part since MESITA-4708) and
// an old bill reload (?tab=). A saved card's Stripe return (?card=) stays: the page's
// Pay with reads it.
export default async function Page({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const payment = one(sp.payment);
  if (isRouteId(payment)) {
    const checkout = one(sp.checkout);
    redirect(`${payReceiptPath(payment)}${checkout ? `?checkout=${encodeURIComponent(checkout)}` : ""}`);
  }
  const tab = one(sp.tab);
  if (isRouteId(tab)) redirect(payBillPath(tab));
  const place = one(sp.place);
  if (isRouteId(place)) redirect(payCodePath(place));
  // ?tab=cards (MESITA-4765, D6): the Loyalty Cards tab the guest left. An
  // id there is an old bill reload, forwarded above.
  // The old sheet's address: the picker is a page (MESITA-4837).
  if (one(sp.pick) === "1") redirect(CONSUMER_ROUTES.payPick);
  return <PayPage tab={tab === "cards" ? "cards" : "offers"} />;
}
