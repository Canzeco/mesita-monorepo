import { RefundsModal } from "@/components/consumer/me/RefundsModal";

// /me/refunds' fallback is the page itself: every word is fixed and nothing
// loads, as on Cards (MESITA-2701).
export default function RefundsLoading() {
  return <RefundsModal />;
}
