"use client";

// Mesita Payments' Stripe account — a SUB-STEP of the catalogue, not a ninth
// card. It is also where Stripe's stored `return_url` lands, which is why the
// bare place address forwards its whole query here.
import { NotHeld, useHeldPlaceOrNull } from "@/components/console/PlaceScope";
import { PlaceHeading } from "@/components/console/PlaceHeading";
import { PayView } from "@/components/views/PayView";

export default function ProductsPayPage() {
  const place = useHeldPlaceOrNull();
  // THE GATE THESE PAGES WERE MISSING. They are static segments beside
  // `[view]`, so no tab gate ever runs for them: a pool id typed into the bar,
  // or the scenario flipped to a failed read while one of them was open, used
  // to reach the body with no place at all. It sits after the hooks and before
  // the first `place.` — a guard below a dereference is not a guard.
  if (!place) return <NotHeld />;

  return (
    <>
      <PlaceHeading place={place} view="Products · Mesita Payments" />
      <PayView />
    </>
  );
}
