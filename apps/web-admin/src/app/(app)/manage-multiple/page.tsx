import { MultiplePlacesClient } from "./MultiplePlacesClient";

// The whole tool, one page. Three boxes: Create, Enrich, Create + Enrich.
// Spend estimates are on Intake — this page does not price a run.

export const dynamic = "force-dynamic";

export default function ManageMultiplePlacesPage() {
  return <MultiplePlacesClient />;
}
