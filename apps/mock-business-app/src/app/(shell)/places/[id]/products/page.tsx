"use client";

// PRODUCTS, WITH NOTHING OPEN (MESITA-1986).
//
// The index is the layout's; this is only the pane beside it. On a phone it is
// the whole screen, and the index is what you see instead — `ProductShell`
// hides one of the two below `lg`.
//
// THE DEFAULT PANE IS MESITA PARTNER, because it is the one thing five other
// products sit behind. Half a screen holding an empty state on arrival is half
// a screen teaching you that it is usually empty. It is a product now
// (MESITA-2011) and the second row rather than the first, which changes what
// the pane is CALLED and not why it is the one that opens.
import { MembershipReturnNotice } from "@/components/console/MembershipReturnNotice";
import { PartnershipPane } from "@/components/console/PartnershipPane";
import { useHeldPlaceOrNull } from "@/components/console/PlaceScope";

export default function ProductsPage() {
  const place = useHeldPlaceOrNull();
  if (!place) return null;
  return (
    <>
      <MembershipReturnNotice />
      <PartnershipPane place={place} />
    </>
  );
}
