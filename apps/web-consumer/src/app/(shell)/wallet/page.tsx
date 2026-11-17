import { redirect } from "next/navigation";
import { CONSUMER_ROUTES, isRouteId, walletGiftPath, walletPlacePath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

// /wallet — A DOOR TO THE WALLET PAGE: the page titled "Wallet" (bar tab
// "Wallet", MESITA-4245) lives at /pay and its code is PayPage; MESITA-4199
// merged the two pages ("call that page Pay", since renamed), so /wallet
// forwards to /pay, its query kept (a saved card's Stripe
// return, ?card=, is read there). A place's House Card (/wallet/place/<id>)
// and a friend's credit link (/wallet/gift/<token>) keep their addresses;
// their older query shapes (?place=, ?gift=) still forward to them. It was
// its own bar tab from MESITA-3722 and again from MESITA-3886.
export default async function Page({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const gift = one(sp.gift);
  if (gift) redirect(walletGiftPath(gift));
  const place = one(sp.place);
  if (isRouteId(place)) redirect(walletPlacePath(place));
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") q.set(k, v);
  const rest = q.toString();
  redirect(`${CONSUMER_ROUTES.pay}${rest ? `?${rest}` : ""}`);
}
