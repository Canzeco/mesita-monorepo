import { PayPage } from "@/components/consumer/pay/PayPage";

// /pay — the bar's Pay tab (Home · Search · Pay · Wallet · Me). A guest pays
// a place from their credit there and shows the proof QR to the staff
// (MESITA-3304, W2a); the card part arrives with W2b. One page: its states
// are component state, and the paid one is `?payment=<id>`.
export default function Page() {
  return <PayPage />;
}
