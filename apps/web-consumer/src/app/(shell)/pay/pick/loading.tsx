import { PayBillSkeleton } from "@/components/consumer/pay/PayPage";

// A cold hit of /pay/pick shows the wallet's Pay Bill bone, not the retired
// "Where are you paying?" screen. The page redirects to /pay?pick=1.
export default function PayPickLoading() {
  return <PayBillSkeleton />;
}
