import { SoonSection } from "../../sections/SoonSection";

// Scan is gated "Soon" in nav.ts — the tab is non-navigable; this handles
// direct URLs with a coming-soon placeholder.
export default function UnitScanPage() {
  return <SoonSection label="Scan" />;
}
