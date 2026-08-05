"use client";

import { AdminSection } from "../../sections/AdminSection";
import { useUnitPlace } from "../../UnitPlaceContext";

// Admin — the Mesita-internal tab (Pato, 2026-08-04): Manual Priority,
// Scores, Ownership, Metadata, Embeddings. Everything a business must never
// see or set.
export default function UnitAdminPage() {
  const { place } = useUnitPlace();

  return (
    <div className="mx-auto max-w-7xl">
      <AdminSection place={place} />
    </div>
  );
}
