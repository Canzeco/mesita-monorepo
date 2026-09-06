// The 404 boundary for a single place.
//
// Without this the nearest boundary is `(shell)/not-found.tsx`, which sits
// ABOVE this segment — so a 404 on one tab unmounts PlaceBar along with the
// page. Under a permanent header that is the wrong shape: the operator loses
// the place's name and its whole menu at once, and a non-super-admin who types
// `/places/<id>/admin` lands somewhere with no way back to the place.
//
// Keeping the boundary inside the segment is not possible for the layout's own
// notFound() (that one legitimately unmounts the place), but a tab page's is,
// and that is the case an operator can actually reach by hand.
import { PageErrorState } from "@/components/business/PageErrorState";

export default function PlaceTabNotFound() {
  return (
    <PageErrorState
      heading="That tab isn't available here"
      message="This place doesn't have that section, or your role can't open it. The tabs above are the ones you can see."
      retryHref="/places"
    />
  );
}
