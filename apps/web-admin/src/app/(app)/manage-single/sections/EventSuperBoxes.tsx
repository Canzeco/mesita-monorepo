"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { AlertTriangle, X } from "lucide-react";
import { formatAbsoluteUtc, timeAgo } from "@/lib/format";
import {
  listNotifications,
  type NotificationItem,
  type NotificationType,
  type NotificationsPayload,
} from "../../global-performance/actions";
import { MetaRow } from "../../global-performance/NotificationMeta";
import {
  TYPE_CONFIG,
  UNKNOWN_TYPE_CONFIG,
} from "../../global-performance/notification-config";
import { reviewTicketReport, type AdminPlace, type PlaceStats } from "../actions";
import { formatPesosCompact } from "@/lib/format";

// Performance → Event Super Boxes (collapse-empty horizontal rails).
//
// Replaces the Activity filter + vertical list. Each consumer event type is
// its own section: analytics lead tile (PlaceStats) + newest-first cards.
// Empty types collapse to one line; all-zero places get a single summary.
// Reports pin above the funnel when count > 0. IG Stories omitted until a
// notification type exists (do not fake zero).

const AUTO_REFRESH_MS = 30_000;
const CARD_LIMIT = 12;

const REPORT_REASON: Record<string, string> = {
  discount_refused: "discount refused",
  closed_without_honoring: "closed without honoring",
  qr_not_scanned: "QR never scanned",
  other: "other",
};

type BoxKey =
  | "saves"
  | "tickets"
  | "visits"
  | "closed"
  | "reviews"
  | "reports";

type BoxDef = {
  key: BoxKey;
  type: NotificationType;
  label: string;
  emptyHint: string;
};

const BOXES: BoxDef[] = [
  {
    key: "saves",
    type: "consumer.place_saved",
    label: "Saves",
    emptyHint: "Waiting for first save",
  },
  {
    key: "tickets",
    type: "rewards.ticket_created",
    label: "Tickets",
    emptyHint: "No tickets unlocked yet",
  },
  {
    key: "visits",
    type: "rewards.ticket_visit",
    label: "Visits",
    emptyHint: "No QR claims yet",
  },
  {
    key: "closed",
    type: "rewards.ticket_closed",
    label: "Closed",
    emptyHint: "Waiting for first close",
  },
  {
    key: "reviews",
    type: "rewards.review_submitted",
    label: "Mesita reviews",
    emptyHint: "No Mesita reviews yet",
  },
  {
    key: "reports",
    type: "rewards.ticket_reported",
    label: "Reports",
    emptyHint: "None — good",
  },
];

const SUPER_TYPES: NotificationType[] = BOXES.map((b) => b.type);

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function compact(n: number): string {
  return n.toLocaleString();
}

function countFor(
  key: BoxKey,
  stats: PlaceStats,
  place: AdminPlace,
  feedCount: number,
): number {
  switch (key) {
    case "saves":
      return stats.saves;
    case "tickets":
      return stats.tickets;
    case "visits":
      return stats.visits;
    case "closed":
      return stats.closed;
    case "reviews":
      return num(place.mesita_review_count) ?? 0;
    case "reports":
      return feedCount;
  }
}

function analyticsPrimary(
  key: BoxKey,
  stats: PlaceStats,
  place: AdminPlace,
  total: number,
): string {
  if (key === "reviews") {
    const count = num(place.mesita_review_count) ?? 0;
    if (count <= 0) return "—";
    const stars = num(place.mesita_stars_overall);
    return stars != null ? stars.toFixed(1) : compact(count);
  }
  return compact(total);
}

function analyticsHint(key: BoxKey, place: AdminPlace, total: number): string {
  if (key === "reviews") {
    const count = num(place.mesita_review_count) ?? 0;
    return count > 0
      ? `${compact(count)} review${count === 1 ? "" : "s"}`
      : "no reviews yet";
  }
  if (key === "tickets") return "unlocked";
  if (key === "visits") return "QR scanned";
  if (key === "reports") return total > 0 ? "view only here" : "all time";
  return "all time";
}

function analyticsSecondary(
  key: BoxKey,
  stats: PlaceStats,
  total: number,
): string | null {
  if (key === "saves" && stats.visitRate != null) {
    return `${stats.visitRate}% → visit`;
  }
  if (key === "visits" && stats.closeRate != null) {
    return `${stats.closeRate}% close`;
  }
  if (key === "closed" && stats.influencedCents > 0) {
    return `${formatPesosCompact(stats.influencedCents)} influenced`;
  }
  if (key === "reviews") return "from Mesita guests";
  if (key === "reports" && total > 0) return "needs follow-up";
  if (key === "tickets") return null;
  return null;
}

function eventMeta(item: NotificationItem): string | null {
  const m = item.meta ?? {};
  switch (item.type) {
    case "consumer.place_saved": {
      const source =
        typeof m.source === "string"
          ? m.source
          : typeof m.from === "string"
            ? m.from
            : null;
      return source ? `From ${source}` : null;
    }
    case "rewards.ticket_created": {
      const cls =
        typeof m.rewardClass === "string"
          ? m.rewardClass
          : typeof m.class === "string"
            ? m.class
            : typeof m.status === "string"
              ? m.status
              : null;
      return cls;
    }
    case "rewards.ticket_visit": {
      const cls =
        typeof m.rewardClass === "string"
          ? m.rewardClass
          : typeof m.class === "string"
            ? m.class
            : null;
      return cls ? `Claimed · ${cls}` : "Claimed";
    }
    case "rewards.ticket_closed": {
      const cents =
        typeof m.subtotalCents === "number"
          ? m.subtotalCents
          : typeof m.totalCents === "number"
            ? m.totalCents
            : null;
      if (cents != null && cents > 0) {
        const cur = typeof m.currency === "string" ? ` ${m.currency}` : "";
        return `Bill $${(cents / 100).toLocaleString()}${cur}`;
      }
      return "Closed";
    }
    case "rewards.review_submitted": {
      if (typeof m.overall === "number") return `${m.overall}★`;
      return null;
    }
    case "rewards.ticket_reported": {
      if (typeof m.reason === "string") {
        return REPORT_REASON[m.reason] ?? m.reason;
      }
      return "Guest reported";
    }
    default:
      return null;
  }
}

const RAIL_SCROLL =
  "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-0.5 scrollbar-none";

export function EventSuperBoxes({
  place,
  stats,
}: {
  place: AdminPlace;
  stats: PlaceStats;
}) {
  const [feed, setFeed] = useState<NotificationsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startRefresh] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const update = () => setNow(Date.now());
    const first = setTimeout(update, 0);
    const iv = setInterval(update, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, []);

  const refresh = useCallback(() => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError(null);
    startRefresh(async () => {
      const r = await listNotifications("all", {
        projectId: place.id,
        types: SUPER_TYPES,
        limit: 150,
      });
      inFlightRef.current = false;
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setFeed(r.data);
    });
  }, [place.id]);

  useEffect(() => {
    let alive = true;
    listNotifications("all", {
      projectId: place.id,
      types: SUPER_TYPES,
      limit: 150,
    }).then((r) => {
      if (!alive) return;
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setFeed(r.data);
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (document.hidden) return;
      refresh();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(iv);
  }, [refresh]);

  useEffect(() => {
    if (!expandedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedId]);

  useEffect(() => {
    if (expandedId && panelRef.current) {
      panelRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [expandedId]);

  const byType = useMemo(() => {
    const map = new Map<NotificationType, NotificationItem[]>();
    for (const t of SUPER_TYPES) map.set(t, []);
    for (const n of feed?.notifications ?? []) {
      const list = map.get(n.type);
      if (list) list.push(n);
    }
    return map;
  }, [feed]);

  const totals = useMemo(() => {
    const out: Record<BoxKey, number> = {
      saves: 0,
      tickets: 0,
      visits: 0,
      closed: 0,
      reviews: 0,
      reports: 0,
    };
    for (const b of BOXES) {
      const fc = feed?.counts[b.type] ?? byType.get(b.type)?.length ?? 0;
      out[b.key] = countFor(b.key, stats, place, fc);
    }
    return out;
  }, [stats, place, feed, byType]);

  const ordered = useMemo(() => {
    const reports = BOXES.find((b) => b.key === "reports")!;
    const rest = BOXES.filter((b) => b.key !== "reports");
    return totals.reports > 0 ? [reports, ...rest] : [...rest, reports];
  }, [totals.reports]);

  const allZero = BOXES.every((b) => totals[b.key] === 0);

  const updatedLabel =
    feed == null || now === null
      ? feed
        ? formatAbsoluteUtc(feed.generatedAt)
        : null
      : timeAgo(feed.generatedAt, now);

  return (
    <section aria-label="Event receipts" className="flex flex-col gap-4">
      <div className="border-border flex items-baseline justify-between gap-3 border-t pt-5">
        <h2 className="text-muted-foreground type-label font-semibold tracking-[0.12em] uppercase">
          Event receipts
        </h2>
        <div className="text-muted-foreground flex items-center gap-2 type-label">
          {updatedLabel && <span>Updated {updatedLabel}</span>}
          <button
            type="button"
            onClick={refresh}
            disabled={pending}
            className="hover:text-foreground underline-offset-2 hover:underline disabled:opacity-50"
          >
            {pending ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-3 rounded-xl border p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Couldn&apos;t load event receipts.</p>
            <p className="mt-1 opacity-90">{error}</p>
            <button
              type="button"
              onClick={refresh}
              className="mt-2 text-xs font-semibold underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {allZero ? (
        <p className="text-muted-foreground border-border rounded-xl border border-dashed px-4 py-5 text-sm">
          No consumer events yet
          <span className="mt-1 block text-xs">
            {BOXES.map((b) => b.label).join(" · ")}
          </span>
        </p>
      ) : (
        ordered.map((box) => {
          const total = totals[box.key];
          const items = byType.get(box.type) ?? [];
          const visible = items.slice(0, CARD_LIMIT);
          const truncated = items.length > CARD_LIMIT || total > CARD_LIMIT;
          const showOf = Math.max(total, items.length);
          const expandedItem =
            expandedId && visible.some((i) => i.id === expandedId)
              ? (items.find((i) => i.id === expandedId) ?? null)
              : null;
          const urgent = box.key === "reports" && total > 0;

          if (total === 0 && items.length === 0) {
            return (
              <div
                key={box.key}
                className="border-border text-muted-foreground flex items-center justify-between gap-3 rounded-xl border border-dashed px-3 py-2.5 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <ToneDot type={box.type} />
                  <span className="text-foreground font-medium">{box.label}</span>
                  <span>· 0</span>
                </span>
                <span className="shrink-0 text-xs">{box.emptyHint}</span>
              </div>
            );
          }

          return (
            <div key={box.key} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3 px-0.5">
                <h3
                  className={
                    "flex items-center gap-2 text-sm font-semibold " +
                    (urgent ? "text-primary" : "text-foreground")
                  }
                >
                  <ToneDot type={box.type} />
                  {box.label}
                </h3>
                <span
                  className={
                    "type-label " +
                    (urgent ? "text-primary font-medium" : "text-muted-foreground")
                  }
                >
                  {urgent ? "needs follow-up · " : ""}
                  newest first
                </span>
              </div>

              {!feed ? (
                <div className={RAIL_SCROLL} aria-busy="true">
                  <div className="bg-muted/50 border-border h-[5.5rem] w-[10.5rem] shrink-0 animate-pulse rounded-2xl border" />
                  <div className="bg-muted/40 border-border h-[5.5rem] w-[9.75rem] shrink-0 animate-pulse rounded-2xl border" />
                  <div className="bg-muted/40 border-border h-[5.5rem] w-[9.75rem] shrink-0 animate-pulse rounded-2xl border" />
                </div>
              ) : (
                <ul
                  className={RAIL_SCROLL}
                  role="list"
                  tabIndex={0}
                  aria-label={`${box.label} events`}
                  onKeyDown={(e) => {
                    const rail = e.currentTarget;
                    if (e.key === "ArrowRight") {
                      e.preventDefault();
                      rail.scrollBy({ left: 180, behavior: "smooth" });
                    } else if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      rail.scrollBy({ left: -180, behavior: "smooth" });
                    }
                  }}
                >
                  <li role="listitem" className="shrink-0 snap-start">
                    <AnalyticsTile
                      label={box.label}
                      primary={analyticsPrimary(box.key, stats, place, total)}
                      hint={analyticsHint(box.key, place, total)}
                      secondary={analyticsSecondary(box.key, stats, total)}
                      urgent={urgent}
                    />
                  </li>
                  {visible.map((item) => (
                    <li key={item.id} role="listitem" className="shrink-0 snap-start">
                      <EventCard
                        item={item}
                        now={now}
                        selected={expandedId === item.id}
                        onToggle={() =>
                          setExpandedId((id) =>
                            id === item.id ? null : item.id,
                          )
                        }
                      />
                    </li>
                  ))}
                  {truncated && (
                    <li
                      role="listitem"
                      className="text-muted-foreground border-border bg-muted/30 flex h-[5.5rem] w-[7.5rem] shrink-0 snap-start items-center justify-center rounded-2xl border border-dashed px-3 text-center text-xs"
                    >
                      Showing {Math.min(CARD_LIMIT, visible.length)} of{" "}
                      {compact(showOf)}
                    </li>
                  )}
                </ul>
              )}

              {expandedItem && (
                <ExpandPanel
                  ref={panelRef}
                  item={expandedItem}
                  onClose={() => setExpandedId(null)}
                  onTriaged={refresh}
                />
              )}
            </div>
          );
        })
      )}
    </section>
  );
}

function ToneDot({ type }: { type: NotificationType }) {
  const cfg = TYPE_CONFIG[type] ?? UNKNOWN_TYPE_CONFIG;
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${cfg.tone.dot}`}
      aria-hidden
    />
  );
}

function AnalyticsTile({
  label,
  primary,
  hint,
  secondary,
  urgent,
}: {
  label: string;
  primary: string;
  hint: string;
  secondary: string | null;
  urgent?: boolean;
}) {
  const empty = primary === "—";
  return (
    <div
      className={
        "border-border w-[10.5rem] rounded-2xl border p-4 " +
        (urgent
          ? "border-indigo-200 bg-gradient-to-br from-white to-indigo-50"
          : "from-card to-primary/[0.04] bg-gradient-to-br")
      }
    >
      <p className="text-muted-foreground type-meta font-semibold tracking-[0.12em] uppercase">
        {label}
      </p>
      <p
        className={
          "mt-1.5 text-3xl leading-none font-semibold tracking-tight " +
          (empty ? "text-muted-foreground" : "text-foreground")
        }
      >
        {primary}
      </p>
      <p className="text-muted-foreground mt-1.5 type-label">{hint}</p>
      {secondary && (
        <p className="text-foreground mt-2 type-label font-medium">{secondary}</p>
      )}
    </div>
  );
}

function EventCard({
  item,
  now,
  selected,
  onToggle,
}: {
  item: NotificationItem;
  now: number | null;
  selected: boolean;
  onToggle: () => void;
}) {
  const when =
    now === null
      ? formatAbsoluteUtc(item.occurredAt)
      : timeAgo(item.occurredAt, now);
  const meta = eventMeta(item);
  const who = item.actor?.trim() || "Guest";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={selected}
      className={
        "border-border bg-card shadow-card flex h-[5.5rem] w-[9.75rem] flex-col items-start rounded-2xl border p-3 text-left transition " +
        (selected
          ? "ring-primary/40 border-primary/40 ring-2"
          : "hover:bg-muted/30")
      }
    >
      <span className="text-muted-foreground type-meta">{when}</span>
      <span className="mt-1 w-full truncate text-sm font-semibold">{who}</span>
      {meta && (
        <span className="text-muted-foreground mt-1 w-full truncate type-label">
          {meta}
        </span>
      )}
    </button>
  );
}

const ExpandPanel = forwardRef<
  HTMLDivElement,
  { item: NotificationItem; onClose: () => void; onTriaged?: () => void }
>(function ExpandPanel({ item, onClose, onTriaged }, ref) {
  const cfg = TYPE_CONFIG[item.type] ?? UNKNOWN_TYPE_CONFIG;
  const labelId = useId();

  return (
    <div
      ref={ref}
      role="region"
      aria-labelledby={labelId}
      className="border-border bg-card shadow-card max-h-64 overflow-y-auto rounded-2xl border p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            id={labelId}
            className={`type-label font-semibold tracking-[0.12em] uppercase ${cfg.tone.kicker}`}
          >
            {cfg.label}
          </p>
          <p className="mt-1 text-sm font-semibold">
            {item.actor?.trim() || "Guest"}
          </p>
          <p className="text-muted-foreground mt-0.5 type-label">
            {formatAbsoluteUtc(item.occurredAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground rounded-lg p-1"
          aria-label="Close details"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {item.detail && (
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          {item.detail}
        </p>
      )}
      <div className="mt-2">
        <MetaRow item={item} />
      </div>
      {item.type === "rewards.ticket_reported" && (
        <ReportTriageRow item={item} onTriaged={onTriaged} />
      )}
    </div>
  );
});

// Ghost-partner hold triage (MESITA-1311). A report is EVIDENCE, never an
// auto-strike — this is where the human call happens. Confirm marks the
// report reviewed AND puts the place's Visit Rewards on hold
// (pending_review closes the lane until Restore in the Partnership box);
// Dismiss just closes the report.
function ReportTriageRow({
  item,
  onTriaged,
}: {
  item: NotificationItem;
  onTriaged?: () => void;
}) {
  const [busy, setBusy] = useState<"confirm" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  const reportId =
    typeof item.meta.reportId === "string" ? item.meta.reportId : null;
  const status = typeof item.meta.status === "string" ? item.meta.status : null;

  if (!reportId) {
    // An older feed payload without the id — nothing to drive.
    return (
      <p className="text-muted-foreground mt-3 type-label">
        Refresh the feed to triage this report.
      </p>
    );
  }

  if (outcome) {
    return <p className="text-muted-foreground mt-3 type-label">{outcome}</p>;
  }

  if (status !== "open") {
    return (
      <p className="text-muted-foreground mt-3 type-label">
        Already {status} — the trail lives on the report row.
      </p>
    );
  }

  const triage = async (action: "confirm" | "dismiss") => {
    if (busy) return;
    setBusy(action);
    setError(null);
    const r = await reviewTicketReport({ action, reportId });
    setBusy(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setOutcome(
      action === "confirm"
        ? "Confirmed — Visit Rewards are on hold. Restore lives in the Partnership box."
        : "Dismissed — no place state changed.",
    );
    onTriaged?.();
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void triage("confirm")}
          disabled={busy !== null}
          className="bg-destructive/10 text-destructive hover:bg-destructive/15 inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-60"
        >
          {busy === "confirm" ? "Confirming…" : "Confirm — hold Visit Rewards"}
        </button>
        <button
          type="button"
          onClick={() => void triage("dismiss")}
          disabled={busy !== null}
          className="border-border bg-card hover:bg-muted/60 inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-60"
        >
          {busy === "dismiss" ? "Dismissing…" : "Dismiss report"}
        </button>
      </div>
      <div aria-live="polite">
        {error && (
          <p className="text-destructive type-label">{error}</p>
        )}
      </div>
    </div>
  );
}
