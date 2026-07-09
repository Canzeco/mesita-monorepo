"use client";

import { ProductsSection } from "../../sections/ProductsSection";
import { useUnitPlace } from "../../UnitPlaceContext";

export default function UnitProductsPage() {
  const { place, setPlace } = useUnitPlace();
  return <ProductsSection key={place.id} place={place} onSaved={setPlace} />;
}
