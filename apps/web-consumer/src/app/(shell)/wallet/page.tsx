import { redirect } from "next/navigation";
import { WalletPage } from "@/components/consumer/wallet/WalletPage";
import { isRouteId, walletGiftPath, walletPlacePath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

// /wallet — the bar's Wallet tab (Pato, MESITA-3295: "Home Search Pay Wallet
// Me"): the two rails. A place's House Card is /wallet/<placeId> and a
// friend's credit link /wallet/gift/<token> (MESITA-3614); their older
// query shapes (?place=, and the ?gift= links already sent) forward here in
// one hop. Stripe's one-shot returns (?prepay=, ?card=) stay on this page.
export default async function Page({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const gift = one(sp.gift);
  if (gift) redirect(walletGiftPath(gift));
  const place = one(sp.place);
  if (isRouteId(place)) redirect(walletPlacePath(place));
  return <WalletPage />;
}
