import { redirect } from "next/navigation";
import { CONSUMER_ROUTES, isRouteId, walletGiftPath, walletPlacePath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

// /wallet — A DOOR SINCE MESITA-3631 (Pato: "Merge wallet and pay into the
// same page. Pay on top"): the Wallet's rails live under Pay, so /wallet
// forwards to /pay in one hop, keeping any one-shot return on it (a saved
// card's ?card=). A place's House Card (/wallet/<placeId>) and a friend's
// credit link (/wallet/gift/<token>) are still live pages (MESITA-3614);
// their older query shapes (?place=, ?gift=) forward to them.
export default async function Page({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const gift = one(sp.gift);
  if (gift) redirect(walletGiftPath(gift));
  const place = one(sp.place);
  if (isRouteId(place)) redirect(walletPlacePath(place));
  const rest = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") rest.set(k, v);
  const q = rest.toString();
  redirect(`${CONSUMER_ROUTES.pay}${q ? `?${q}` : ""}`);
}
