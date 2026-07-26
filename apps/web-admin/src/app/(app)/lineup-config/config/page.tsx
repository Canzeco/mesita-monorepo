import { SubscoresPanel } from "../subscores/SubscoresPanel";
import { LanesPanel } from "../lanes/LanesPanel";

// Config — the whole Lineup model on one page (Pato 2026-07-26, collapsed from
// the old Subscores/Scores/Lanes tabs): the six collapsible subscore boxes,
// then how the deck composes (lane formulas + per-lane counts + the merge) and
// the Lineup engine reference. The Playground is the only other subpage.
// Everything reads/writes the shared ScoringProvider mounted in the layout, so
// knobs here drive the Playground live.
export default function LineupConfigPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <SubscoresPanel />
      <LanesPanel />
    </div>
  );
}
