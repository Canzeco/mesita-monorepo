import { BuyCreditsPage } from "@/components/consumer/wallet/WalletPickers";

// /wallet/buy — Pay's Prepay (`?offers=vouchers`) and Explore Offers
// (`?offers=any`): the places with that kind of offer; a row opens its Offers
// (MESITA-4096, MESITA-4731).
export default async function Page({ searchParams }: { searchParams: Promise<{ offers?: string }> }) {
  const { offers } = await searchParams;
  return <BuyCreditsPage offers={offers === "vouchers" ? "vouchers" : "any"} />;
}
