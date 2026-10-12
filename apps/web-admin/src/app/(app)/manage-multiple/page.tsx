import { MultiplePlacesClient } from "./MultiplePlacesClient";

// The whole tool, one page. Five boxes: two read, Create, Enrich and Update
// write. Spend estimates are on Configurations › Intake —
// this page does not price a run.

export const dynamic = "force-dynamic";

export default function ManageMultiplePlacesPage() {
  return <MultiplePlacesClient />;
}
