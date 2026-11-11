import { PayPage } from "@/components/consumer/pay/PayPage";

export const dynamic = "force-dynamic";

// /wallet/gift/<token> — a friend's credit link (MESITA-3292): the Wallet,
// with "Take the credit" open over it (MESITA-3614; /wallet?gift= before).
// It draws the one Pay page at its Wallet (MESITA-3720).
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PayPage focus="wallet" giftToken={decodeURIComponent(token)} />;
}
