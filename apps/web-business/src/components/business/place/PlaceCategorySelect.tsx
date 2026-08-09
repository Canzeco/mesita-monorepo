"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  apiListPlaceCategories,
  type PlaceCategoryOption,
} from "@/lib/api/place-categories";
import { cn } from "@/lib/utils";
import { resolvePlaceCategoryName } from "@/lib/place-category";
import { INPUT_CLASS as INPUT } from "@/lib/ui-classes";
import { deslugify } from "./place-utils";

export function PlaceCategorySelect({
  value,
  onChange,
  googleCategoryLabel,
  googleCategorySlug,
}: {
  value: string;
  onChange: (slug: string) => void;
  googleCategoryLabel?: string | null;
  googleCategorySlug?: string | null;
}) {
  const supabase = useBrowserSupabase();
  const [categories, setCategories] = useState<PlaceCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // `loading` initializes to true and `supabase` is a stable memo, so the
    // effect runs once — no synchronous setState needed to enter the loading
    // state (which would trigger a cascading render).
    let cancelled = false;
    apiListPlaceCategories(supabase)
      .then((rows) => {
        if (!cancelled) setCategories(rows);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const sections = useMemo(() => {
    const grouped = new Map<string, PlaceCategoryOption[]>();
    for (const row of categories) {
      const list = grouped.get(row.section) ?? [];
      list.push(row);
      grouped.set(row.section, list);
    }
    return Array.from(grouped.entries());
  }, [categories]);

  const googleHint =
    resolvePlaceCategoryName({ categoryLabel: googleCategoryLabel }) ??
    resolvePlaceCategoryName({ category: googleCategorySlug });

  const showGoogleHint =
    Boolean(googleHint) && (!value || value === (googleCategorySlug ?? ""));

  if (loading) {
    return (
      <div className="text-muted-foreground border-border/60 bg-muted/40 flex h-10 items-center gap-1.5 rounded-xl border px-3 py-2.5 text-[12px]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {showGoogleHint ? (
        <p className="text-muted-foreground/70 text-[10px]">
          From Google · {googleHint}
        </p>
      ) : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          INPUT,
          "h-10 text-[13px]",
          !value && "text-muted-foreground",
        )}
        aria-label="Category"
      >
        <option value="">Select category</option>
        {value && !categories.some((c) => c.slug === value) ? (
          <option value={value}>{deslugify(value)}</option>
        ) : null}
        {sections.map(([section, rows]) => (
          <optgroup key={section} label={section}>
            {rows.map((row) => (
              <option key={row.slug} value={row.slug}>
                {row.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
