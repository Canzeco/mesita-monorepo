import { SoonSection } from "../../sections/SoonSection";

// Products is gated "Soon" in nav.ts — the tab is non-navigable; this handles
// direct URLs with a coming-soon placeholder.
export default function UnitProductsPage() {
  return <SoonSection label="Products" />;
}
