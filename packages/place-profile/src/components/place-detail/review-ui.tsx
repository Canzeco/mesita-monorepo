import type React from "react";
import { Star, Users } from "lucide-react";

import { cn } from "../../lib/format";

export function ExternalCard({
  logo,
  icon,
  value,
  meta,
}: {
  logo: React.ReactNode;
  icon: "star" | "users";
  value: string;
  meta: string;
}) {
  return (
    <div className="bg-background flex flex-col items-center gap-1.5 rounded-xl px-2 py-3">
      <div className="mb-1">{logo}</div>
      <div className="flex items-center gap-1 text-sm font-semibold">
        {icon === "star" ? (
          <Star
            className="h-3.5 w-3.5 fill-foreground text-muted-foreground"
            strokeWidth={0}
          />
        ) : (
          <Users className="text-muted-foreground h-3.5 w-3.5" />
        )}
        {value}
      </div>
      <p className="text-muted-foreground type-body leading-tight">{meta}</p>
    </div>
  );
}

// decision: Pato — frontend-only review sort (no EF). Newest default by
// published date; Highest / Lowest by rating, date breaking ties.
export type ReviewSort = "newest" | "highest" | "lowest";

type SortOption<K extends string> = { key: K; label: string };

const REVIEW_SORTS: SortOption<ReviewSort>[] = [
  { key: "newest", label: "Newest" },
  { key: "highest", label: "Highest" },
  { key: "lowest", label: "Lowest" },
];

export function reviewTimeMs(date: string): number {
  const t = Date.parse(date);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Inline sort row (MESITA-2309): plain words, the chosen one a filled ink
 * pill, no grey track around them. Generic over the option list so a list
 * declares the sorts that make sense for its own content. Keep sets to three
 * or four short words so they stay on one row at 360px.
 */
function SortChips<K extends string>({
  sort,
  onSort,
  options,
  label,
}: {
  sort: K;
  onSort: (next: K) => void;
  options: readonly SortOption<K>[];
  label: string;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      {options.map((mode) => (
        <button
          key={mode.key}
          type="button"
          onClick={() => onSort(mode.key)}
          aria-pressed={sort === mode.key}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold transition",
            sort === mode.key
              ? "bg-foreground text-paper"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

export function ReviewSortChips({
  sort,
  onSort,
  label,
}: {
  sort: ReviewSort;
  onSort: (next: ReviewSort) => void;
  label: string;
}) {
  return (
    <SortChips
      sort={sort}
      onSort={onSort}
      options={REVIEW_SORTS}
      label={label}
    />
  );
}
