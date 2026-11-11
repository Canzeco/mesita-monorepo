import { PayFrameLoading } from "@/components/consumer/pay/PayFrameLoading";

// /wallet's fallback: its own frame, the band on Wallet (MESITA-3698).
export default function WalletLoading() {
  return <PayFrameLoading body="wallet" />;
}
