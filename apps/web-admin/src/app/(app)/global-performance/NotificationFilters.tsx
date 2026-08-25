import { RefreshCw } from "lucide-react";
import type { NotificationsPayload, NotificationType } from "./actions";
import { TYPE_CONFIG, TYPE_ORDER, TONES } from "./notification-config";
import {
  DOMAINS,
  STATUS_FACTS,
  STEP_TYPE,
  typesInDomain,
  type DomainKey,
  type StatusFactKey,
} from "./notification-feed";

export type TypeFilter = "all" | NotificationType;
export type StatusFilter = "all" | StatusFactKey;

const STATUS_DOT: Record<StatusFactKey, string> = {
  seeded: TONES.indigo.dot,
  active: TONES.emerald.dot,
  listed: TONES.sky.dot,
  enriched: TONES.rose.dot,
  verified: TONES.amber.dot,
  partner: TONES.indigo.dot,
  promoting: TONES.rose.dot,
};

export function NotificationFilters({
  domain,
  typeFilter,
  statusFilter,
  includeSteps,
  total,
  counts,
  statusCounts,
  placeQuery,
  updatedLabel,
  pending,
  types = TYPE_ORDER,
  showDomains = true,
  onDomainChange,
  onTypeFilterChange,
  onStatusFilterChange,
  onIncludeStepsChange,
  onPlaceQueryChange,
  onRefresh,
}: {
  domain: DomainKey;
  typeFilter: TypeFilter;
  statusFilter: StatusFilter;
  includeSteps: boolean;
  total: number;
  counts: NotificationsPayload["counts"];
  statusCounts: Record<StatusFactKey, number>;
  placeQuery: string;
  updatedLabel: string;
  pending: boolean;
  types?: NotificationType[];
  showDomains?: boolean;
  onDomainChange: (domain: DomainKey) => void;
  onTypeFilterChange: (filter: TypeFilter) => void;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onIncludeStepsChange: (next: boolean) => void;
  onPlaceQueryChange?: (query: string) => void;
  onRefresh: () => void;
}) {
  const domainTypes = typesInDomain(domain, types).filter(
    (t) => includeSteps || t !== STEP_TYPE,
  );
  const showStepsToggle = showDomains && (domain === "all" || domain === "atlas");

  return (
    <div className="border-border bg-card/95 supports-[backdrop-filter]:bg-card/85 sticky top-0 z-30 border-y backdrop-blur-md">
      {showDomains && (
        <div
          role="tablist"
          aria-label="Domain"
          className="border-border flex gap-1 overflow-x-auto border-b px-4 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-5 [&::-webkit-scrollbar]:hidden"
        >
          {DOMAINS.map((d) => {
            const active = domain === d.key;
            return (
              <button
                key={d.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onDomainChange(d.key)}
                className={
                  "-mb-px inline-flex shrink-0 items-center border-b-2 px-3 py-2.5 text-sm font-medium transition sm:px-4 " +
                  (active
                    ? "border-secondary text-secondary"
                    : "text-muted-foreground hover:text-foreground border-transparent")
                }
              >
                {d.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-stretch overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <FilterSegment
          active={
            domain === "atlas"
              ? statusFilter === "all"
              : typeFilter === "all"
          }
          label="All"
          count={total}
          onClick={() =>
            domain === "atlas"
              ? onStatusFilterChange("all")
              : onTypeFilterChange("all")
          }
        />
        {domain === "atlas"
          ? STATUS_FACTS.map((fact) => (
              <FilterSegment
                key={fact.key}
                active={statusFilter === fact.key}
                label={fact.label}
                count={statusCounts[fact.key] ?? 0}
                dot={STATUS_DOT[fact.key]}
                onClick={() => onStatusFilterChange(fact.key)}
              />
            ))
          : domainTypes.map((t) => (
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
          {showStepsToggle && (
            <button
              type="button"
              aria-pressed={includeSteps}
              onClick={() => onIncludeStepsChange(!includeSteps)}
              className={
                "rounded-lg px-2.5 py-1.5 type-eyebrow transition " +
                (includeSteps
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")
              }
            >
              Intaker steps
            </button>
          )}
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
            className="text-muted-foreground type-label hidden sm:inline"
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
          "type-meta rounded-full px-1.5 py-0.5 tabular-nums " +
          (active ? "bg-background text-foreground" : "bg-muted text-muted-foreground")
        }
      >
        {count}
      </span>
    </button>
  );
}
