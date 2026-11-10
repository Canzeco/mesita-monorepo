import { PayPage } from "@/components/consumer/pay/PayPage";

export const dynamic = "force-dynamic";

// /wallet/gift/<token> — a friend's credit link (MESITA-3292): Pay, with the
// Wallet under it (MESITA-3631), and "Take the credit" open over it
// (MESITA-3614; /wallet?gift= before).
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PayPage giftToken={decodeURIComponent(token)} />;
}
