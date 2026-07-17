import { SubscoresPanel } from "./SubscoresPanel";

// Subscores — every subscore's knobs + data-access contract, the saved-config
// bar, and the Subscore playground (one consumer × intent × place, internals
// visible). Sample + saved settings come from the layout's ScoringProvider.
export default function ScoringSubscoresPage() {
  return <SubscoresPanel />;
}
