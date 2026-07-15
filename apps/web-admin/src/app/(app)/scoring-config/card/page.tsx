import { CardSimPanel } from "./CardSimPanel";

// Card Sim — one consumer × intent × place = one CARD with its four Scores;
// every Sub-Score's internal process on that single card. Sample + saved
// settings come from the layout's ScoringProvider.
export default function ScoringCardSimPage() {
  return <CardSimPanel />;
}
