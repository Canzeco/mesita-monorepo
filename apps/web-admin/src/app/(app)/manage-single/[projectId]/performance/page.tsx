import { SoonSection } from "../../sections/SoonSection";

// Performance is gated "Soon" in nav.ts — the tab is non-navigable; this handles
// direct URLs with a coming-soon placeholder.
export default function UnitPerformancePage() {
  return <SoonSection label="Performance" />;
}
