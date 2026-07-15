"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { listPlaceTagCatalog, type PlaceCategoryOption } from "./actions";
import { INPUT_BASE } from "./ui";

// Atlas category picker for Manage Single Unit Basics (MESITA-469).
// Catalog from admin-web-get-atlas-fields — same source Atlas Config / tags use.

export function PlaceCategorySelect({
  value,
  onChange,
  disabled,
  googleLabel,
}: {
  value: string;
  onChange: (slug: string) => void;
  disabled?: boolean;
  /** Friendly label currently on the place (category_label) — shown while loading. */
  googleLabel?: string | null;
}) {
  const [categories, setCategories] = useState<PlaceCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listPlaceTagCatalog().then((r) => {
      if (!alive) return;
      setCategories(r.ok ? r.data.categories : []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const sections = useMemo(() => {
    const grouped = new Map<string, PlaceCategoryOption[]>();
    for (const row of categories) {
      const list = grouped.get(row.section) ?? [];
      list.push(row);
      grouped.set(row.section, list);
    }
    return Array.from(grouped.entries());
  }, [categories]);

  if (loading) {
    return (
      <label className="flex flex-col gap-1.5">
        <span className="text-foreground/90 text-[13px] font-medium">Category</span>
        <span className="text-muted-foreground flex h-10 items-center gap-1.5 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading…
          {googleLabel ? (
            <span className="text-muted-foreground/70 truncate">· {googleLabel}</span>
          ) : null}
        </span>
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-foreground/90 text-[13px] font-medium">Category</span>
      <span className="relative block">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Category"
          className={
            INPUT_BASE +
            " h-10 appearance-none pr-9 pl-3.5" +
            (!value ? " text-muted-foreground" : "")
          }
        >
          <option value="">Select category</option>
          {value && !categories.some((c) => c.slug === value) ? (
            <option value={value}>
              {googleLabel?.trim() || value.replace(/_/g, " ")}
            </option>
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
        <ChevronDown
          className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
          aria-hidden
        />
      </span>
    </label>
  );
}
