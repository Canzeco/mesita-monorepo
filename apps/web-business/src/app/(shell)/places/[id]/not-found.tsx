// The 404 boundary for a single place.
//
// Without this the nearest boundary is `(shell)/not-found.tsx`, which sits
// ABOVE this segment — so a 404 on one view unmounts the place's heading along
// with the page. That is the wrong shape: the operator loses the place's name
// and, because the layout stops publishing it, the rail's whole place section
// with it — and a non-super-admin who types `/places/<id>/admin` lands
// somewhere with no way back to the place.
//
// Keeping the boundary inside the segment is not possible for the layout's own
// notFound() (that one legitimately unmounts the place), but a tab page's is,
// and that is the case an operator can actually reach by hand.
import { PageErrorState } from "@/components/business/PageErrorState";

export default function PlaceTabNotFound() {
  return (
    <PageErrorState
      heading="That tab isn't available here"
      message="This place doesn't have that section, or your role can't open it. The views in the menu are the ones you can see."
      retryHref="/places"
    />
  );
}
