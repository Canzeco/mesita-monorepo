import { PayFrameLoading } from "@/components/consumer/pay/PayFrameLoading";

// /pay's fallback: the page's own frame (MESITA-2701).
export default function PayLoading() {
  return <PayFrameLoading />;
}
