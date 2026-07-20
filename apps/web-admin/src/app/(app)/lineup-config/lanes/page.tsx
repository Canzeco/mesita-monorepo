import { LanesPanel } from "./LanesPanel";

// Lanes — COMPOSE the deck: per-lane counts + the merge, Lineup's callers,
// and the consumer-filters mapping. Formulas live on Scores; simulators on
// Playground.
export default function ScoringLanesPage() {
  return <LanesPanel />;
}
