"use client";

import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { INPUT_BASE } from "@/components/admin-ui/manage";
import { usePlaceContext } from "./PlaceContext";

// Atlas category picker. Options arrive on the profile read, each already
// carrying its family display. Nothing here fetches.

export function PlaceCategorySelect({
  value,
  onChange,
  disabled,
  googleLabel,
}: {
  value: string;
  onChange: (slug: string) => void;
  disabled?: boolean;
  /** Label already on the place, for a slug the vocabulary no longer lists. */
  googleLabel?: string | null;
}) {
  const { profile } = usePlaceContext();
  const categories = profile.categories;

  const sections = useMemo(() => {
    const grouped = new Map<string, typeof categories>();
    for (const row of categories) {
      const list = grouped.get(row.section) ?? [];
      list.push(row);
      grouped.set(row.section, list);
    }
    return Array.from(grouped.entries());
  }, [categories]);

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-foreground/90 type-body font-medium">Category</span>
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
