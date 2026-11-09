import { CardsModal } from "@/components/consumer/me/CardsModal";

// /me/cards' fallback is the page itself: every word is fixed and every line
// is Soon, as on Connector (MESITA-2701).
export default function CardsLoading() {
  return <CardsModal />;
}
