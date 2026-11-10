import { PayFrameLoading } from "@/components/consumer/pay/PayFrameLoading";

// A credit link lands on Pay: Pay's frame (MESITA-3631).
export default function Loading() {
  return <PayFrameLoading />;
}
