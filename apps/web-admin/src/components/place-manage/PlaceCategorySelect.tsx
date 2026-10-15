"use client";

import { ReadField } from "@/components/admin-ui/manage";

// The category is Google's primary type. Admin reads it. Nothing here fetches.

function readableCategory(slug: string): string {
  const trimmed = slug.trim();
  if (!trimmed) return "—";
  return trimmed.replaceAll("_", " ");
}

export function PlaceCategorySelect({ value }: { value: string }) {
  return (
    <ReadField label="Category" auto boxed>
      <span aria-label={`Category: ${readableCategory(value)}`}>
        {readableCategory(value)}
      </span>
    </ReadField>
  );
}
