"use client";

// A SNAPSHOT of apps/web-business/src/components/place-manage/
// PlaceCategorySelect.tsx — the Atlas category picker for Basics.
//
// ONE DIFFERENCE, and it is the app's whole premise: there the catalog arrives
// from `business-web-get-atlas-fields` through a server action, so the field
// spends a render as a spinner saying "Loading… · Steakhouse". Here it is an
// import, so there is nothing to wait for and the loading branch is gone. A
// mock cannot fake a network it does not have, and a `setTimeout` pretending
// to be one would be a state nobody could get out of.

import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { CATEGORIES } from "@/mock/atlas";
import { INPUT_BASE } from "@/components/admin-ui/manage";

export function PlaceCategorySelect({
  value,
  onChange,
  disabled,
  googleLabel,
}: {
  value: string;
  onChange: (slug: string) => void;
  disabled?: boolean;
  /** Friendly label currently on the place (category_label). */
  googleLabel?: string | null;
}) {
  const sections = useMemo(() => {
    const grouped = new Map<string, typeof CATEGORIES>();
    for (const row of CATEGORIES) {
      const list = grouped.get(row.section) ?? [];
      list.push(row);
      grouped.set(row.section, list);
    }
    return Array.from(grouped.entries());
  }, []);

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
          {value && !CATEGORIES.some((c) => c.slug === value) ? (
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
