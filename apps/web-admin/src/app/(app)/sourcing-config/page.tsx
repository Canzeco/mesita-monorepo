import { permanentRedirect } from "next/navigation";

// Sourcing matrix is retired. Search and Add eligibility is Discovery › Map.
// catalog.ts stays: familiesForGoogleType still expands those Table A types.
export default function SourcingConfigRedirect() {
  permanentRedirect("/filters-config");
}
