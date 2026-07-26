import { ScoresPanel } from "./ScoresPanel";

// Scores — how the five subscores combine into the two lane scores.
// Read-mostly; tuning lives on Subscores (the shared provider keeps the
// live definitions here in sync with unsaved edits over there).
export default function ScoringScoresPage() {
  return <ScoresPanel />;
}
