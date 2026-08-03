"use client";

import { ProductsSection } from "../../sections/ProductsSection";
import { useUnitPlace } from "../../UnitPlaceContext";

// Products — own tab again (MESITA-834; MESITA-368 had folded it into Place).
export default function UnitProductsPage() {
  const { place, setPlace } = useUnitPlace();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col gap-4 pb-8 lg:gap-5 lg:pb-10">
        <ProductsSection key={place.id} place={place} onSaved={setPlace} />
      </div>
    </div>
  );
}
