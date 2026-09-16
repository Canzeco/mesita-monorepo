"use client";

// Mesita Payments' Stripe account — a SUB-STEP of the catalogue, not a ninth
// card. It is also where Stripe's stored `return_url` lands, which is why the
// bare place address forwards its whole query here.
import { notFound } from "next/navigation";
import { NotHeld, useHeldPlaceOrNull, usePlaceScope } from "@/components/console/PlaceScope";
import { PlaceHeading } from "@/components/console/PlaceHeading";
import { PayView } from "@/components/views/PayView";

export default function ProductsPayPage() {
  const place = useHeldPlaceOrNull();
  const { pages } = usePlaceScope();
  // THE GATE THESE PAGES WERE MISSING. They are static segments beside
  // `[view]`, so no tab gate ever runs for them: a pool id typed into the bar,
  // or the scenario flipped to a failed read while one of them was open, used
  // to reach the body with no place at all. It sits after the hooks and before
  // the first `place.` — a guard below a dereference is not a guard.
  if (!place) return <NotHeld />;
  // AND HELD AS WHAT (MESITA-1933). `NotHeld` above answers "is this place
  // held"; it has never answered the role, and until now nothing did for this
  // page — the rail's product rows were running `tabsForAccess` and that was
  // the whole console's role check. The rows are gone, so the gate is here.
  // `notFound`, like `PlaceTabGate`: a page reachable by typing its address is
  // a page, whatever the rail chose to draw.
  if (!pages.includes("products")) notFound();

  return (
    <>
      <PlaceHeading place={place} view="Products · Mesita Payments" />
      <PayView />
    </>
  );
}
