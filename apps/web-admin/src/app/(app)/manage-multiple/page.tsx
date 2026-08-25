import { MultiplePlacesClient } from "./MultiplePlacesClient";

// The whole tool, one page. Three boxes plus Edit at the bottom.
// Spend estimates are on Intake — this page does not price a run.

export const dynamic = "force-dynamic";

export default function ManageMultiplePlacesPage() {
  return <MultiplePlacesClient />;
}
