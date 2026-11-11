import { PayFrameLoading } from "@/components/consumer/pay/PayFrameLoading";

// /wallet's fallback: the Wallet tab's own frame (MESITA-3722).
export default function WalletLoading() {
  return <PayFrameLoading body="wallet" />;
}
