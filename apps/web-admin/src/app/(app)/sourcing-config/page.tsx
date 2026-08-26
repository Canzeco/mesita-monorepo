import { permanentRedirect } from "next/navigation";

// Sourcing matrix is retired. Search and Add eligibility is Discovery › Map.
export default function SourcingConfigRedirect() {
  permanentRedirect("/filters-config");
}
