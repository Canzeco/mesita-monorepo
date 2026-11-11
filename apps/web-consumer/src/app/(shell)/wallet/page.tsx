import { redirect } from "next/navigation";
import { PayPage } from "@/components/consumer/pay/PayPage";
import { isRouteId, walletGiftPath, walletPlacePath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

// /wallet — THE ONE PAY PAGE, OPENED AT ITS WALLET (Pato, 2026-11-11,
// MESITA-3720: "only one" page): the same page as /pay, scrolled to the
// Wallet heading. MESITA-3698 had made it a page of its own. A place's House Card (/wallet/<placeId>) and a friend's credit
// link (/wallet/gift/<token>) are its children (MESITA-3614); their older
// query shapes (?place=, ?gift=) forward to them. A saved card's Stripe
// return (?card=) is read by the page itself.
export default async function Page({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const gift = one(sp.gift);
  if (gift) redirect(walletGiftPath(gift));
  const place = one(sp.place);
  if (isRouteId(place)) redirect(walletPlacePath(place));
  return <PayPage focus="wallet" />;
}
