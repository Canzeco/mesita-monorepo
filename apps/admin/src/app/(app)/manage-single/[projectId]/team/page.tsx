import { SoonSection } from "../../sections/SoonSection";

// Team is gated "Soon" in nav.ts — the tab is non-navigable; this handles
// direct URLs with a coming-soon placeholder.
export default function UnitTeamPage() {
  return <SoonSection label="Team" />;
}
