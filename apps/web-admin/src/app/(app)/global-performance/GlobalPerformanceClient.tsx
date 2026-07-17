"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { formatAbsoluteUtc, timeAgo } from "@/lib/format";
import { listNotifications, type NotificationsPayload } from "./actions";
import {
  NotificationFilters,
  type TypeFilter,
} from "./NotificationFilters";
import { NotificationRow } from "./NotificationRow";

// Poll cadence for the background auto-refresh (paused while the tab is
// hidden — the operator still has the manual Refresh button).
const AUTO_REFRESH_MS = 30_000;

export function GlobalPerformanceClient({
  initial,
}: {
  initial: NotificationsPayload;
}) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
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

  // Guard against overlapping fetches (manual click + poll tick).
  const inFlightRef = useRef(false);
  const refresh = useCallback(() => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError(null);
    startRefresh(async () => {
      const r = await listNotifications("all");
      inFlightRef.current = false;
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setData(r.data);
    });
  }, []);

  // Auto-refresh while the tab is visible; document.hidden pauses the poll.
  useEffect(() => {
    const iv = setInterval(() => {
      if (document.hidden) return;
      refresh();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(iv);
  }, [refresh]);

  const visible = useMemo(() => {
    const q = placeQuery.trim().toLowerCase();
    return data.notifications.filter(
      (n) =>
        (typeFilter === "all" || n.type === typeFilter) &&
        (q === "" || (n.place?.name ?? "").toLowerCase().includes(q)),
    );
  }, [data.notifications, typeFilter, placeQuery]);

  const updatedLabel =
    now === null
      ? formatAbsoluteUtc(data.generatedAt)
      : timeAgo(data.generatedAt, now);

  return (
    <div className="-mx-4 mt-6 sm:-mx-6 sm:mt-8 lg:-mx-8">
      <NotificationFilters
        typeFilter={typeFilter}
        total={data.total}
        counts={data.counts}
        placeQuery={placeQuery}
        updatedLabel={updatedLabel}
        pending={pending}
        onTypeFilterChange={setTypeFilter}
        onPlaceQueryChange={setPlaceQuery}
        onRefresh={refresh}
      />

      <div className="px-4 pt-4 sm:px-6 lg:px-8">
        {error && (
          <div className="border-destructive/40 bg-destructive/5 text-destructive mb-4 flex items-start gap-3 rounded-xl border p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {visible.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-16 text-center">
            <Inbox className="h-5 w-5" />
            <p className="text-sm">
              {data.total === 0
                ? "No notifications yet. They'll show up here as places are created, enriched, and claimed."
                : placeQuery.trim() !== ""
                  ? "Nothing matches this place filter."
                  : "Nothing in this filter."}
            </p>
          </div>
        ) : (
          <ul className="border-border bg-card divide-border overflow-hidden rounded-xl border">
            {visible.map((n) => (
              <NotificationRow key={n.id} item={n} now={now} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
