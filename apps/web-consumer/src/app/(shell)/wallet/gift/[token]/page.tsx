import { WalletPage } from "@/components/consumer/wallet/WalletPage";

export const dynamic = "force-dynamic";

// /wallet/gift/<token> — a friend's credit link (MESITA-3292): the Wallet,
// with "Take the credit" open over it (MESITA-3614; /wallet?gift= before).
// It drew Pay with the Wallet under it from MESITA-3631 to MESITA-3698.
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <WalletPage giftToken={decodeURIComponent(token)} />;
}
