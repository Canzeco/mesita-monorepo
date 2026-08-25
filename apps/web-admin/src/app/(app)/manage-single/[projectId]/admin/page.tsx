"use client";

import { AdminSection } from "../../sections/AdminSection";
import { usePlaceContext } from "../../PlaceContext";

// Admin — the Mesita-internal tab: Status, Intake, Enrichment,
// Verification, SERP, Embedding, Metadata. Everything a business must
// never see or set.
export default function PlaceAdminPage() {
  const { place } = usePlaceContext();

  return (
    <div className="mx-auto max-w-7xl">
      <AdminSection place={place} />
    </div>
  );
}
