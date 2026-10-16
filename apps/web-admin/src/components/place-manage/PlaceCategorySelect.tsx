"use client";

import { ReadField } from "@/components/admin-ui/manage";
import { googleCategoryDisplay } from "./google-category-display";

// Google's primary type. Admin reads it; Create and Enrich write it.

export function PlaceCategorySelect({
  slug,
  label,
}: {
  slug: string | null;
  label: string | null;
}) {
  const display = googleCategoryDisplay(slug, label);

  return (
    <ReadField label="Google category" auto boxed>
      <span aria-label={`Google category: ${display}`}>{display}</span>
    </ReadField>
  );
}
