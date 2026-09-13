"use client";

// Admin — the operator internals, rendered only for super-admins (the
// layout's tab matrix never offers this tab to a restaurant). States, intake
// chips, enrichment, verification, SERP, embedding, metadata.
import { AdminSection } from "@/components/place-manage/sections/AdminSection";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

export function AdminTab() {
  const { place } = usePlaceContext();
  return <AdminSection place={place} />;
}
