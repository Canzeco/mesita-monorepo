import { SubscoresPanel } from "./SubscoresPanel";

// Subscores — TUNE: every subscore's knobs + data-access contract, per-box
// save. Sample + saved settings come from the layout's ScoringProvider.
// The simulators live on the Playground tab.
export default function ScoringSubscoresPage() {
  return <SubscoresPanel />;
}
