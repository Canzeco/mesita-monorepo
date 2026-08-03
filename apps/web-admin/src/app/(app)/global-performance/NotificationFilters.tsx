import { RefreshCw } from "lucide-react";
import type { NotificationsPayload, NotificationType } from "./actions";
import { CATEGORIES, TYPE_CONFIG, TYPE_ORDER } from "./notification-config";

export type TypeFilter = "all" | NotificationType;

export function NotificationFilters({
  typeFilter,
  total,
  counts,
  placeQuery,
  updatedLabel,
  pending,
  types = TYPE_ORDER,
  showCategories = true,
  onTypeFilterChange,
  onPlaceQueryChange,
  onRefresh,
}: {
  typeFilter: TypeFilter;
  total: number;
  counts: NotificationsPayload["counts"];
  placeQuery: string;
  updatedLabel: string;
  pending: boolean;
  /** Which type segments to render — the per-place feed narrows this. */
  types?: NotificationType[];
  /** Hide the static category chips (redundant on a scoped feed). */
  showCategories?: boolean;
  onTypeFilterChange: (filter: TypeFilter) => void;
  /** Omit to hide the place-name input (per-place feed is already one place). */
  onPlaceQueryChange?: (query: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="border-border bg-card/95 supports-[backdrop-filter]:bg-card/85 sticky top-0 z-30 border-y backdrop-blur-md">
      <div className="flex items-stretch overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {showCategories &&
          CATEGORIES.filter((c) => c.live).map((c) => {
            const Icon = c.Icon;
            return (
              <span
                key={c.key}
                className="bg-secondary/10 text-secondary inline-flex shrink-0 items-center gap-1.5 border-r px-3 py-2.5 text-sm font-medium sm:px-4"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {c.label}
              </span>
            );
          })}

        <FilterSegment
          active={typeFilter === "all"}
          label="All"
          count={total}
          onClick={() => onTypeFilterChange("all")}
        />
        {types.map((t) => (
          <FilterSegment
            key={t}
            active={typeFilter === t}
            label={TYPE_CONFIG[t].shortLabel}
            count={counts[t] ?? 0}
            dot={TYPE_CONFIG[t].tone.dot}
            onClick={() => onTypeFilterChange(t)}
          />
        ))}

        <div className="ml-auto flex shrink-0 items-center gap-2 border-l px-3 py-2 sm:px-4">
          {onPlaceQueryChange && (
            <input
              type="text"
              value={placeQuery}
              onChange={(e) => onPlaceQueryChange(e.target.value)}
              placeholder="Filter by place…"
              spellCheck={false}
              className="border-border bg-background focus:border-foreground h-9 w-36 rounded-lg border px-3 text-sm outline-none sm:w-44"
            />
          )}
          <span
            className="text-muted-foreground hidden text-[11px] sm:inline"
            suppressHydrationWarning
          >
            {updatedLabel}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={pending}
            title="Refresh"
            className="text-muted-foreground hover:text-foreground hover:bg-muted/60 inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw className={"h-4 w-4 " + (pending ? "animate-spin" : "")} />
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterSegment({
  active,
  label,
  count,
  dot,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  dot?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex shrink-0 items-center gap-1.5 border-r px-3 py-2.5 text-sm font-medium transition sm:px-4 " +
        (active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")
      }
    >
      {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />}
      {label}
      <span
        className={
          "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums " +
          (active ? "bg-background text-foreground" : "bg-muted text-muted-foreground")
        }
      >
        {count}
      </span>
    </button>
  );
}
