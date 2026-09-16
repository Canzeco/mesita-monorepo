"use client";

// A SNAPSHOT of apps/web-business/src/components/place-manage/
// PlaceFamilyField.tsx — the read-only derived fact between Google price and
// the Category select.
//
// Precedence law, unchanged:
//   · category defined → the category's FULL membership (1–2 families),
//     re-derived LIVE from the current form value (unsaved edits update it);
//   · category `undefined`/unknown → the stored family_keys (the families the
//     Intaker inferred), suffixed "(inferred)";
//   · nothing known → ❓ Undefined.
//
// The real file's em-dash branch — what it shows while the catalog request is
// in flight — cannot happen here: the catalog is an import. See
// PlaceCategorySelect for why that is not worth faking.

import { useMemo } from "react";
import { CATEGORIES, FAMILIES } from "@/mock/atlas";
import { ReadField } from "@/components/admin-ui/manage";

export function PlaceFamilyField({
  category,
  familyKeys,
}: {
  /** Current form value of the Category select (may be unsaved). */
  category: string;
  /** Stored family_keys — the Intaker's inferred families. */
  familyKeys: string[] | null;
}) {
  const display = useMemo(() => {
    const familyBySlug = new Map(FAMILIES.map((f) => [f.slug, f]));
    const chip = (slug: string) => {
      const row = familyBySlug.get(slug);
      return row ? `${row.emoji} ${row.label}` : null;
    };
    const slug = category.trim().toLowerCase();
    if (slug && slug !== "undefined") {
      const membership = (
        CATEGORIES.find((c) => c.slug === slug)?.family_keys ?? []
      ).filter((s) => s !== "undefined");
      const parts = membership.map(chip).filter(Boolean) as string[];
      if (parts.length > 0) return { text: parts.join(" · "), inferred: false };
    }
    const stored = (familyKeys ?? []).filter(
      (s) => s !== "undefined" && familyBySlug.has(s),
    );
    if (stored.length > 0) {
      const parts = stored.map(chip).filter(Boolean) as string[];
      return { text: parts.join(" · "), inferred: true };
    }
    return { text: chip("undefined") ?? "❓ Undefined", inferred: false };
  }, [category, familyKeys]);

  return (
    <ReadField label="Family" auto boxed>
      <span aria-label={`Family: ${display.text}`}>
        <span aria-hidden>{display.text}</span>
        {display.inferred ? (
          <span className="text-muted-foreground/70"> (inferred)</span>
        ) : null}
      </span>
    </ReadField>
  );
}
