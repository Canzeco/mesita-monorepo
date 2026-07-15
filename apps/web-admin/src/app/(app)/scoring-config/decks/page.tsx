import { DeckSimPanel } from "./DeckSimPanel";

// Decks — compose an engine's deck through the sub-deck pipeline: per-lane
// maxes in, sub-decks merged (repeats out, paid copy wins), ordered cards
// out. Sample + saved settings come from the layout's ScoringProvider.
export default function ScoringDecksPage() {
  return <DeckSimPanel />;
}
