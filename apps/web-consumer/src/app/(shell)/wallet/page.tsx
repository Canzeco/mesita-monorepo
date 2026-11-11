import { redirect } from "next/navigation";
import { WalletPage } from "@/components/consumer/wallet/WalletPage";
import { isRouteId, walletGiftPath, walletPlacePath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

// /wallet — THE PAY TAB'S SECOND HALF (Pato, 2026-11-11, MESITA-3698:
// "Divide Payments across two sections: Pay and Wallet"): the Wallet's two
// rails under the Pay · Wallet band. It was a door to /pay from MESITA-3631
// until this. A place's House Card (/wallet/<placeId>) and a friend's credit
// link (/wallet/gift/<token>) are its children (MESITA-3614); their older
// query shapes (?place=, ?gift=) forward to them. A saved card's Stripe
// return (?card=) is read by the page itself.
export default async function Page({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const gift = one(sp.gift);
  if (gift) redirect(walletGiftPath(gift));
  const place = one(sp.place);
  if (isRouteId(place)) redirect(walletPlacePath(place));
  return <WalletPage />;
}
