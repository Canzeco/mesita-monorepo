import { PayFrameLoading } from "@/components/consumer/pay/PayFrameLoading";

// /pay's fallback: the page's own frame (MESITA-2701). In its own route
// group (MESITA-4606) so it wraps the Wallet only: at /pay/loading.tsx it
// also stood in for every page under /pay, and picking a place in Pay
// Bill's step 1 flashed the Wallet's bones before step 2.
export default function PayLoading() {
  return <PayFrameLoading />;
}
