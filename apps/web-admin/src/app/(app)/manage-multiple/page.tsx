import { MultiplePlacesClient } from "./MultiplePlacesClient";

// The whole tool, one page. Five boxes: Google Search and Mesita Search
// read; Mesita Create, Mesita Edit and Mesita Delete write. Spend estimates
// are on Configurations › Creation and Updation — this page does not price a
// run.

export const dynamic = "force-dynamic";

// A box run is one server action that waits on every edge function at once
// (MESITA-3085); a 250-place Create must not hit the default timeout.
export const maxDuration = 300;

export default function ManageMultiplePlacesPage() {
  return <MultiplePlacesClient />;
}
