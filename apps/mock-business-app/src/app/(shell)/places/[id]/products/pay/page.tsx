"use client";

// Mesita Payments' Stripe account — a SUB-STEP of the catalogue, not a ninth
// card. It is also where Stripe's stored `return_url` lands, which is why the
// bare place address forwards its whole query here.
import { useHeldPlace } from "@/components/console/PlaceScope";
import { PlaceHeading } from "@/components/console/PlaceHeading";
import { PayView } from "@/components/views/PayView";

export default function ProductsPayPage() {
  const place = useHeldPlace();
  return (
    <>
      <PlaceHeading place={place} view="Products · Mesita Payments" />
      <PayView />
    </>
  );
}
