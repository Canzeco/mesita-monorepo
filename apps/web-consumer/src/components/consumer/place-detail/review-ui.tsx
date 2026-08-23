import type React from "react";
import { Star, Users } from "lucide-react";

import type { PlaceDetail } from "@/lib/mock/place";
import { cn, formatRating } from "@/lib/utils";

export function RatingBar({ label, value }: { label: string; value: number }) {
  // Pink-gradient fill proportional to value/5, value pinned to the right
  // edge in tabular nums so columns stay aligned across rows.
  const pct = Math.min(100, (value / 5) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground type-label w-14 shrink-0 truncate">
        {label}
      </span>
      <div className="bg-muted relative h-1.5 flex-1 overflow-hidden rounded-full">
        <div
          className="bg-pink-gradient absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-foreground type-label w-8 shrink-0 text-right font-semibold tabular-nums">
        {formatRating(value)!}
      </span>
    </div>
  );
}

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
            className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
            strokeWidth={0}
          />
        ) : (
          <Users className="text-muted-foreground h-3.5 w-3.5" />
        )}
        {value}
      </div>
      <p className="text-muted-foreground type-meta leading-tight">{meta}</p>
    </div>
  );
}

// decision: Pato — frontend-only review sort (no EF) for both Google and
// Mesita. Newest default; Highest / Lowest by rating. Google uses published
// date; Mesita uses avg(food/service/ambience/value) and keeps source order
// for Newest until visitors carry a date field.
//
// Extended for MESITA-1147: every box on the Reviews tab now carries its own
// sort set — stories sort by reach, visits by reward, reservations by party
// size — so the control below is generic over the option list and the three
// review modes are just one such list.
export type ReviewSort = "newest" | "highest" | "lowest";

export type SortOption<K extends string> = { key: K; label: string };

const REVIEW_SORTS: SortOption<ReviewSort>[] = [
  { key: "newest", label: "Newest" },
  { key: "highest", label: "Highest" },
  { key: "lowest", label: "Lowest" },
];

export function reviewTimeMs(date: string): number {
  const t = Date.parse(date);
  return Number.isFinite(t) ? t : 0;
}

export function mesitaOverall(
  v: PlaceDetail["mesita_visitors"][number],
): number {
  return (v.food + v.service + v.ambience + v.value) / 4;
}

/**
 * Segmented sort control. Generic over the option list so each box on the
 * Reviews tab declares the sorts that make sense for its own content.
 *
 * Options stay on one row: at four the labels are already tight on a 360px
 * screen, so keep sets to three or four short words.
 */
export function SortChips<K extends string>({
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
    <div
      className="bg-muted/60 flex gap-1 rounded-xl p-1"
      role="group"
      aria-label={label}
    >
      {options.map((mode) => (
        <button
          key={mode.key}
          type="button"
          onClick={() => onSort(mode.key)}
          aria-pressed={sort === mode.key}
          className={cn(
            "min-w-0 flex-1 truncate rounded-lg px-1 py-1.5 text-xs font-semibold transition",
            sort === mode.key
              ? "bg-card text-foreground shadow-rest"
              : "text-muted-foreground",
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
