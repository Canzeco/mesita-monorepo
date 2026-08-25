"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { AlertTriangle, Flag, Inbox } from "lucide-react";
import { formatAbsoluteUtc, timeAgo } from "@/lib/format";
import {
  listNotifications,
  type NotificationsPayload,
  type NotificationType,
} from "./actions";
import {
  NotificationFilters,
  type StatusFilter,
  type TypeFilter,
} from "./NotificationFilters";
import { NotificationRow, NotificationStepGroup } from "./NotificationRow";
import {
  type DomainKey,
  feedEntryKey,
  groupConsecutiveSteps,
  itemHasStatusFact,
  pinReports,
  statusFactCounts,
  typesForFetch,
} from "./notification-feed";

const AUTO_REFRESH_MS = 30_000;

export function GlobalPerformanceClient({
  initial,
  projectId,
  types,
  bleed = true,
}: {
  initial: NotificationsPayload;
  /** Scope the feed to one place (per-place Performance tab). Hides the
   *  domain tabs + place-name filter and threads the id into refreshes. */
  projectId?: string;
  /** Narrow the filter segments (defaults to every known type). */
  types?: NotificationType[];
  /** Break OUT of the parent's page padding so the filter bar spans edge to
   *  edge — right on the Global Monitor (inside PageContainer), wrong inside
   *  a plain max-width column, where it renders wider than its siblings. */
  bleed?: boolean;
}) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [domain, setDomain] = useState<DomainKey>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [includeSteps, setIncludeSteps] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [pending, startRefresh] = useTransition();

  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const first = setTimeout(update, 0);
    const iv = setInterval(update, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, []);

  const inFlightRef = useRef(false);
  const refresh = useCallback(() => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError(null);
    const fetchTypes = typesForFetch(domain, includeSteps, types);
    startRefresh(async () => {
      const r = await listNotifications(domain, {
        ...(projectId ? { projectId } : {}),
        ...(fetchTypes && fetchTypes.length > 0 ? { types: fetchTypes } : {}),
      });
      inFlightRef.current = false;
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setData(r.data);
    });
  }, [projectId, types, domain, includeSteps]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (document.hidden) return;
      refresh();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(iv);
  }, [refresh]);

  const domainRef = useRef(domain);
  const includeRef = useRef(includeSteps);
  useEffect(() => {
    const domainChanged = domainRef.current !== domain;
    const stepsChanged = includeRef.current !== includeSteps;
    domainRef.current = domain;
    includeRef.current = includeSteps;
    if (domainChanged || stepsChanged) refresh();
  }, [domain, includeSteps, refresh]);

  const onDomainChange = useCallback((next: DomainKey) => {
    setDomain(next);
    setTypeFilter("all");
    setStatusFilter("all");
    if (next !== "all" && next !== "atlas") setIncludeSteps(false);
  }, []);

  const onTypeFilterChange = useCallback((next: TypeFilter) => {
    setTypeFilter(next);
    if (next === "atlas.enrichment_step") setIncludeSteps(true);
  }, []);

  const visible = useMemo(() => {
    const q = placeQuery.trim().toLowerCase();
    return data.notifications.filter(
      (n) =>
        (typeFilter === "all" || n.type === typeFilter) &&
        (statusFilter === "all" || itemHasStatusFact(n, statusFilter)) &&
        (q === "" || (n.place?.name ?? "").toLowerCase().includes(q)),
    );
  }, [data.notifications, placeQuery, typeFilter, statusFilter]);

  const factCounts = useMemo(
    () => statusFactCounts(data.notifications),
    [data.notifications],
  );

  const { reports, rest } = useMemo(() => pinReports(visible), [visible]);
  const entries = useMemo(() => groupConsecutiveSteps(rest), [rest]);

  const updatedLabel =
    now === null
      ? formatAbsoluteUtc(data.generatedAt)
      : timeAgo(data.generatedAt, now);

  return (
    <div className={bleed ? "-mx-4 mt-6 sm:-mx-6 sm:mt-8 lg:-mx-8" : ""}>
      <NotificationFilters
        domain={domain}
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        includeSteps={includeSteps}
        total={data.total}
        counts={data.counts}
        statusCounts={factCounts}
        placeQuery={placeQuery}
        updatedLabel={updatedLabel}
        pending={pending}
        types={types}
        showDomains={!projectId}
        onDomainChange={onDomainChange}
        onTypeFilterChange={onTypeFilterChange}
        onStatusFilterChange={setStatusFilter}
        onIncludeStepsChange={(next) => {
          setIncludeSteps(next);
          if (!next && typeFilter === "atlas.enrichment_step") {
            setTypeFilter("all");
          }
        }}
        onPlaceQueryChange={projectId ? undefined : setPlaceQuery}
        onRefresh={refresh}
      />

      <div className={bleed ? "px-4 pt-4 sm:px-6 lg:px-8" : "pt-4"}>
        {error && (
          <div className="border-destructive/40 bg-destructive/5 text-destructive mb-4 flex items-start gap-3 rounded-xl border p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {reports.length > 0 && (
          <section className="mb-4">
            <p className="text-destructive mb-2 flex items-center gap-1.5 type-eyebrow">
              <Flag className="h-3 w-3" />
              Needs you · {reports.length}
            </p>
            <ul className="border-destructive/30 bg-card divide-border overflow-hidden rounded-xl border">
              {reports.map((n) => (
                <NotificationRow key={n.id} item={n} now={now} pinned />
              ))}
            </ul>
          </section>
        )}

        {entries.length === 0 && reports.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-16 text-center">
            <Inbox className="h-5 w-5" />
            <p className="text-sm">
              {data.total === 0
                ? "Nothing yet. Places, visits and bookings will land here."
                : placeQuery.trim() !== ""
                  ? "Nothing matches this place filter."
                  : "Nothing in this filter."}
            </p>
          </div>
        ) : entries.length === 0 ? null : (
          <ul className="border-border bg-card divide-border overflow-hidden rounded-xl border">
            {entries.map((entry) =>
              entry.kind === "steps" ? (
                <NotificationStepGroup
                  key={feedEntryKey(entry)}
                  items={entry.items}
                  now={now}
                />
              ) : (
                <NotificationRow
                  key={feedEntryKey(entry)}
                  item={entry.item}
                  now={now}
                />
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
