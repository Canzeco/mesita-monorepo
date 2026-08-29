"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import type { NotificationsPayload, NotificationType } from "./actions";
import { TYPE_CONFIG, TYPE_ORDER, TONES } from "./notification-config";
import {
  DOMAINS,
  INTAKE_FUNCTIONS,
  STATUS_FACTS,
  STEP_TYPE,
  typesInDomain,
  type DomainKey,
  type IntakeFilter,
  type IntakeFunctionKey,
  type StatusFactKey,
} from "./notification-feed";
import { ENGINELESS_STATUS_FACT_KEYS } from "@/lib/status-vocabulary";

export type TypeFilter = "all" | NotificationType;
export type StatusFilter = IntakeFilter;

const STATUS_DOT: Record<StatusFactKey, string> = {
  seeded: TONES.indigo.dot,
  active: TONES.emerald.dot,
  listed: TONES.sky.dot,
  requested: TONES.amber.dot,
  enriched: TONES.rose.dot,
  enriching: TONES.emerald.dot,
  verified: TONES.amber.dot,
  partner: TONES.indigo.dot,
  promoting: TONES.rose.dot,
  // Acceptance bits: entries keep the Record total; their segments are
  // filtered out below until an event stamper exists (gateway/Credits PRs).
  mesita_pay: TONES.amber.dot,
  yums: TONES.amber.dot,
};

export function NotificationFilters({
  domain,
  typeFilter,
  statusFilter,
  includeSteps,
  total,
  counts,
  statusCounts,
  functionCounts,
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
  functionCounts: Record<IntakeFunctionKey, number>;
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
  const intake = domain === "atlas";

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

      <div className="flex items-stretch">
        <div className="flex min-w-0 flex-1">
          <FilterSegment
            active={
              intake ? statusFilter === "all" : typeFilter === "all"
            }
            label="All"
            count={total}
            onClick={() =>
              intake
                ? onStatusFilterChange("all")
                : onTypeFilterChange("all")
            }
          />
          {intake
            ? STATUS_FACTS.filter(
                // No event stamper writes the acceptance bits yet, so their
                // segments would count 0 forever and read as a broken feed.
                // The gateway / Credits PRs lift this with their stampers.
                (fact) =>
                  !(ENGINELESS_STATUS_FACT_KEYS as readonly string[]).includes(fact.key),
              ).map((fact) => (
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
        </div>

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

      {intake && (
        <ChipRow>
          {INTAKE_FUNCTIONS.map((fact) => (
            <FilterSegment
              key={fact.key}
              active={statusFilter === `fn:${fact.key}`}
              label={`${fact.n} ${fact.label}`}
              count={functionCounts[fact.key] ?? 0}
              onClick={() => onStatusFilterChange(`fn:${fact.key}`)}
            />
          ))}
        </ChipRow>
      )}
    </div>
  );
}

function ChipRow({ children }: { children: ReactNode }) {
  return <div className="border-border flex w-full border-t">{children}</div>;
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
        "inline-flex min-w-0 flex-1 items-center justify-center gap-1 border-r px-1 py-2 type-label font-medium leading-tight transition sm:gap-1.5 sm:px-2 sm:text-sm " +
        (active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")
      }
    >
      {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />}
      <span className="truncate">{label}</span>
      <span
        className={
          "type-meta shrink-0 rounded-full px-1.5 py-0.5 tabular-nums " +
          (active ? "bg-background text-foreground" : "bg-muted text-muted-foreground")
        }
      >
        {count}
      </span>
    </button>
  );
}
