"use client";

import { AdminSection } from "@/components/place-manage/sections/AdminSection";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

// Operator internals — the three State boxes, Enrichment, Verification, SERP,
// Embedding, Metadata. Super-admin-only in business; everyone here is one.
export default function AdminPlaceAdminPage() {
  const { place } = usePlaceContext();
  return <AdminSection place={place} />;
}
