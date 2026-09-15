// Reviews — the fifth view (MESITA-1807).
//
// A pool place has no manage payload and no Reviews row in the matrix; typed
// by hand it answers 404 rather than throwing inside usePlaceContext. That
// refusal is `PlaceTabGate`'s now (MESITA-1875) — this page used to spend
// `business-web-get-overview` (p50 472ms) on `manage !== null` and then render
// a tab that takes no props.
import { ReviewsTab } from "./ReviewsTab";

export default function ReviewsPage() {
  return <ReviewsTab />;
}
