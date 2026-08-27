import { MultiplePlacesClient } from "./MultiplePlacesClient";

// The whole tool, one page. Three boxes. Intake is one Update box.
// Spend estimates are on Intake Config — this page does not price a run.

export const dynamic = "force-dynamic";

export default function ManageMultiplePlacesPage() {
  return <MultiplePlacesClient />;
}
