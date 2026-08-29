"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listPlaceTagCatalog,
  type PlaceCategoryOption,
  type PlaceSuperCategoryOption,
} from "./actions";
import { ReadField } from "@/components/admin-ui/manage";

// Read-only derived fact, shown in the read-only run above the Category
// select (Google name → Google price → Super Category). Precedence law:
//   · category defined → the category's FULL membership (1–2 supers),
//     re-derived LIVE from the current form value (unsaved edits update it);
//   · category `undefined`/unknown → the stored family_keys (the supers the
//     Intaker inferred), suffixed "(inferred)";
//   · nothing known → ❓ Undefined.
// While the catalog loads (or on catalog error) the field shows an em-dash —
// same posture as an absent Google price. Never raw slugs, never a lie.

export function PlaceSuperCategoryField({
  category,
  familyKeys,
}: {
  /** Current form value of the Category select (may be unsaved). */
  category: string;
  /** Stored places.family_keys — the Intaker's inferred supers. */
  familyKeys: string[] | null;
}) {
  const [catalog, setCatalog] = useState<{
    categories: PlaceCategoryOption[];
    supers: PlaceSuperCategoryOption[];
  } | null>(null);

  useEffect(() => {
    let alive = true;
    listPlaceTagCatalog().then((r) => {
      if (!alive) return;
      if (r.ok && r.data.superCategories.length > 0) {
        setCatalog({
          categories: r.data.categories,
          supers: r.data.superCategories,
        });
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const display = useMemo(() => {
    if (!catalog) return null;
    const superBySlug = new Map(catalog.supers.map((s) => [s.slug, s]));
    const chip = (slug: string) => {
      const row = superBySlug.get(slug);
      return row ? `${row.emoji} ${row.label}` : null;
    };
    const slug = category.trim().toLowerCase();
    if (slug && slug !== "undefined") {
      const membership = (catalog.categories.find((c) => c.slug === slug)
        ?.super_category_slugs ?? []).filter((s) => s !== "undefined");
      const parts = membership.map(chip).filter(Boolean) as string[];
      if (parts.length > 0) return { text: parts.join(" · "), inferred: false };
    }
    const stored = (familyKeys ?? []).filter(
      (s) => s !== "undefined" && superBySlug.has(s),
    );
    if (stored.length > 0) {
      const parts = stored.map(chip).filter(Boolean) as string[];
      return { text: parts.join(" · "), inferred: true };
    }
    return { text: chip("undefined") ?? "❓ Undefined", inferred: false };
  }, [catalog, category, familyKeys]);

  return (
    <ReadField label="Super Category" auto boxed>
      {display ? (
        <span aria-label={`Super category: ${display.text}`}>
          <span aria-hidden>{display.text}</span>
          {display.inferred ? (
            <span className="text-muted-foreground/70"> (inferred)</span>
          ) : null}
        </span>
      ) : (
        <span className="text-muted-foreground/50">—</span>
      )}
    </ReadField>
  );
}
