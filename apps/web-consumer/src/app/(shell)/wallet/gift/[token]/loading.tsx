import { PayFrameLoading } from "@/components/consumer/pay/PayFrameLoading";

// A credit link lands on the Wallet: the Wallet's frame (MESITA-3698).
export default function Loading() {
  return <PayFrameLoading body="wallet" />;
}
