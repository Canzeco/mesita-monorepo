import { SoonSection } from "../../sections/SoonSection";

// Promos is gated "Soon" in nav.ts — the tab is non-navigable; this handles
// direct URLs with a coming-soon placeholder.
export default function UnitPromosPage() {
  return <SoonSection label="Promos" />;
}
