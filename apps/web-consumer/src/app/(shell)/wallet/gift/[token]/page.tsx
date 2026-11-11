import { WalletPage } from "@/components/consumer/wallet/WalletPage";

export const dynamic = "force-dynamic";

// /wallet/gift/<token> — a friend's credit link (MESITA-3292): the Wallet,
// with "Take the credit" open over it (MESITA-3614; /wallet?gift= before).
// It draws the Wallet tab's page (MESITA-3722).
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <WalletPage giftToken={decodeURIComponent(token)} />;
}
