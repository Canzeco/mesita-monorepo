import { CardsPanel } from "./CardsPanel";

// Cards — one consumer × intent × place = one CARD with its four Scores;
// every Subscore's internal process on that single card. Sample + saved
// settings come from the layout's ScoringProvider.
export default function ScoringCardsPage() {
  return <CardsPanel />;
}
