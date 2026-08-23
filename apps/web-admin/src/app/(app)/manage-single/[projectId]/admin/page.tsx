"use client";

import { AdminSection } from "../../sections/AdminSection";
import { usePlaceContext } from "../../PlaceContext";

// Admin — the Mesita-internal tab (Pato, 2026-08-04): Scores, Verification,
// Metadata, Embeddings. Everything a business must never see or set.
export default function PlaceAdminPage() {
  const { place } = usePlaceContext();

  return (
    <div className="mx-auto max-w-7xl">
      <AdminSection place={place} />
    </div>
  );
}
