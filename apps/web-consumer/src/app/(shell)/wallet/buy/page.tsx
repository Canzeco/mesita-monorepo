import { redirect } from "next/navigation";
import { BuyCreditsPage } from "@/components/consumer/wallet/WalletPickers";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// /wallet/buy — Pay's Prepay: the places that sell a voucher; a row opens
// its Offers at Prepay (MESITA-4096, MESITA-4731). Explore Offers
// (`?offers=any`) lives on Pay's Nearby Offers tab since MESITA-4765, so
// that old address forwards there.
export default async function Page({ searchParams }: { searchParams: Promise<{ offers?: string }> }) {
  const { offers } = await searchParams;
  if (offers === "any") redirect(CONSUMER_ROUTES.pay);
  return <BuyCreditsPage />;
}
