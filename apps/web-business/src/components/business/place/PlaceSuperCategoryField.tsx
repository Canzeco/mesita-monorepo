"use client";

import { useEffect, useMemo, useState } from "react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiListPlaceCategoryCatalog,
  type PlaceCategoryOption,
  type PlaceSuperCategoryOption,
} from "@/lib/api/place-categories";
import { PlaceKvField } from "./PlaceKvField";

// Read-only derived fact above the Category select. Precedence law (shared
// with the admin console): category defined → the category's FULL membership
// (1–2 supers), re-derived live from the current form value; category
// undefined/unknown → the stored family_keys (Intaker-inferred), suffixed
// "(inferred)"; nothing known → ❓ Undefined. While the catalog loads or on a
// catalog error the value is an em-dash — never raw slugs, never a lie.

export function PlaceSuperCategoryField({
  category,
  familyKeys,
}: {
  /** Current form value of the Category select (may be unsaved). */
  category: string;
  /** Stored places.family_keys — the Intaker's inferred supers. */
  familyKeys: string[] | null;
}) {
  const supabase = useBrowserSupabase();
  const [catalog, setCatalog] = useState<{
    categories: PlaceCategoryOption[];
    supers: PlaceSuperCategoryOption[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiListPlaceCategoryCatalog(supabase)
      .then((r) => {
        if (!cancelled && r.superCategories.length > 0) {
          setCatalog({ categories: r.categories, supers: r.superCategories });
        }
      })
      .catch(() => {
        // Graceful posture: the field keeps its em-dash.
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

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
      return { text: `${parts.join(" · ")} (inferred)`, inferred: true };
    }
    return { text: chip("undefined") ?? "❓ Undefined", inferred: false };
  }, [catalog, category, familyKeys]);

  return (
    <PlaceKvField
      label="Super Category"
      hint="Derived from your category — change Category to move it."
      value={display ? display.text : "—"}
      blocked
    />
  );
}
