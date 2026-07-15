import { SubscoresPanel } from "./SubscoresPanel";

// Subscores — every Subscore's knobs + data-access contract (what data
// computes it), plus the saved-config bar. The Cards tab is the playground
// that walks each Subscore's internals. Sample + saved settings come from
// the layout's ScoringProvider.
export default function ScoringSubscoresPage() {
  return <SubscoresPanel />;
}
