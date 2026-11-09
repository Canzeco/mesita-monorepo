"use client";

import { AdminSection } from "@/components/place-manage/sections/AdminSection";
import { usePlaceContext } from "@/components/place-manage/PlaceContext";

// The place's internal facts, the page that was web-admin's Single Place ›
// Admin (MESITA-3104): Profile States, Place States (MESITA-3588), Special actions (MESITA-3159), Reviews
// States, Reports, Enrichment, the page's own cards (Verification), Vectors and
// Metadata. It reads the live place so a write here shows at once.
export function AdminCards({ children }: { children?: React.ReactNode }) {
  const { place } = usePlaceContext();
  return <AdminSection place={place}>{children}</AdminSection>;
}
