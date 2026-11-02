"use client";

import { AdminSection } from "@/components/place-manage/sections/AdminSection";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

// The place's internal facts, the page that was web-admin's Single Place ›
// Admin (MESITA-3104): State (Disable), Profile Stats, Actions (reservations,
// prepayments), Reviews States, Reports, Enrichment (Enrich), Vectors and
// Metadata. It reads the live place so a write here shows at once.
export function InternalCards() {
  const { place } = usePlaceContext();
  return <AdminSection place={place} />;
}
