"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock,
  Compass,
  CreditCard,
  ExternalLink,
  Inbox,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import { formatAbsoluteUtc, timeAgo } from "@/lib/format";
import {
  listNotifications,
  type NotificationItem,
  type NotificationsPayload,
  type NotificationType,
} from "./actions";

// ── Notification type presentation ─────────────────────────────────────

type TypeConfig = {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  circle: string;
  chip: string;
  actorPrefix: string;
};

const TYPE_CONFIG: Record<NotificationType, TypeConfig> = {
  "atlas.venue_created": {
    label: "New venue created",
    Icon: Building2,
    circle: "bg-emerald-100 text-emerald-700",
    chip: "bg-emerald-100 text-emerald-700",
    actorPrefix: "Owner",
  },
  "atlas.venue_enriched": {
    label: "Place enriched",
    Icon: Sparkles,
    circle: "bg-violet-100 text-violet-700",
    chip: "bg-violet-100 text-violet-700",
    actorPrefix: "By",
  },
  "atlas.ownership_claimed": {
    label: "Ownership claimed",
    Icon: BadgeCheck,
    circle: "bg-amber-100 text-amber-700",
    chip: "bg-amber-100 text-amber-700",
    actorPrefix: "Claimed by",
  },
};

const TYPE_ORDER: NotificationType[] = [
  "atlas.venue_created",
  "atlas.venue_enriched",
  "atlas.ownership_claimed",
];

const CLAIM_METHOD_LABEL: Record<string, string> = {
  ai_call: "Phone OTP",
  video: "Video walkthrough",
  postcard: "Postcard",
};

// ── Categories ─────────────────────────────────────────────────────────
// Atlas is live; the rest are declared so the multi-category structure is
// visible and the next category is a config entry, not a rewrite.

type CategoryDef = {
  key: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  live: boolean;
};

const CATEGORIES: CategoryDef[] = [
  { key: "atlas", label: "Atlas", Icon: Compass, live: true },
  { key: "billing", label: "Billing", Icon: CreditCard, live: false },
  { key: "verifications", label: "Verifications", Icon: ShieldCheck, live: false },
  { key: "consumers", label: "Consumers", Icon: Users, live: false },
];

type TypeFilter = "all" | NotificationType;

export function GlobalPerformanceClient({
  initial,
}: {
  initial: NotificationsPayload;
}) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [pending, startRefresh] = useTransition();

  // Client-only clock so relative timestamps don't trip hydration. null on
  // the server / first paint (we show an absolute UTC stamp until mounted),
  // then ticks every 30s.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // Update only from timer callbacks (an external clock), never
    // synchronously in the effect body. The 0ms timeout fills in the first
    // value right after paint; the interval keeps it fresh.
    const update = () => setNow(Date.now());
    const first = setTimeout(update, 0);
    const iv = setInterval(update, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, []);

  const refresh = () => {
    if (pending) return;
    setError(null);
    startRefresh(async () => {
      const r = await listNotifications("all");
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setData(r.data);
    });
  };

  const visible = useMemo(
    () =>
      typeFilter === "all"
        ? data.notifications
        : data.notifications.filter((n) => n.type === typeFilter),
    [data.notifications, typeFilter],
  );

  const updatedLabel =
    now === null
      ? formatAbsoluteUtc(data.generatedAt)
      : timeAgo(data.generatedAt, now);

  return (
    <div className="mt-6 flex flex-col gap-4 sm:mt-8 sm:gap-6">
      {/* Category strip */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((c) => {
          const Icon = c.Icon;
          return (
            <span
              key={c.key}
              className={
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold " +
                (c.live
                  ? "border-secondary/30 bg-secondary/10 text-secondary"
                  : "border-border text-muted-foreground/60")
              }
              title={c.live ? undefined : "Coming soon"}
            >
              <Icon className="h-3.5 w-3.5" />
              {c.label}
              {!c.live && (
                <span className="text-muted-foreground/50 ml-0.5 text-[9px] tracking-wider uppercase">
                  soon
                </span>
              )}
            </span>
          );
        })}
      </div>

      {/* Toolbar: type filters + refresh */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterChip
            active={typeFilter === "all"}
            label="All"
            count={data.total}
            onClick={() => setTypeFilter("all")}
          />
          {TYPE_ORDER.map((t) => (
            <FilterChip
              key={t}
              active={typeFilter === t}
              label={TYPE_CONFIG[t].label}
              count={data.counts[t] ?? 0}
              onClick={() => setTypeFilter(t)}
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="text-muted-foreground text-[11px]" suppressHydrationWarning>
            Updated {updatedLabel}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={pending}
            className="border-border text-foreground hover:bg-muted inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={"h-4 w-4 " + (pending ? "animate-spin" : "")} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-3 rounded-2xl border p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-2xl border border-dashed p-12 text-center">
          <Inbox className="h-6 w-6" />
          <p className="text-sm">
            {data.total === 0
              ? "No notifications yet. They'll show up here as venues are created, enriched, and claimed."
              : "Nothing in this filter."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((n) => (
            <NotificationCard key={n.id} item={n} now={now} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition " +
        (active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:text-foreground hover:bg-muted")
      }
    >
      {label}
      <span
        className={
          "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums " +
          (active ? "bg-background/20" : "bg-muted text-muted-foreground")
        }
      >
        {count}
      </span>
    </button>
  );
}

function NotificationCard({
  item,
  now,
}: {
  item: NotificationItem;
  now: number | null;
}) {
  const cfg = TYPE_CONFIG[item.type];
  const Icon = cfg.Icon;
  const venue = item.venue;
  const when =
    now === null
      ? formatAbsoluteUtc(item.occurredAt)
      : timeAgo(item.occurredAt, now);

  return (
    <li className="border-border bg-card flex gap-3 rounded-2xl border p-4 sm:gap-4 sm:p-5">
      <span
        className={
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full " +
          cfg.circle
        }
      >
        <Icon className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <span
            className={
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase " +
              cfg.chip
            }
          >
            {cfg.label}
          </span>
          <span
            className="text-muted-foreground shrink-0 text-[11px]"
            title={formatAbsoluteUtc(item.occurredAt)}
            suppressHydrationWarning
          >
            {when}
          </span>
        </div>

        <p className="font-display mt-2 text-base font-semibold tracking-tight">
          {venue?.name ?? "(venue removed)"}
          {venue?.categoryLabel && (
            <span className="text-muted-foreground ml-2 text-xs font-medium">
              {venue.categoryLabel}
            </span>
          )}
        </p>

        {venue?.address && (
          <p className="text-muted-foreground mt-0.5 flex items-start gap-1 text-[12px]">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="min-w-0">{venue.address}</span>
          </p>
        )}

        <ActorLine item={item} prefix={cfg.actorPrefix} />

        {item.detail && (
          <p className="text-muted-foreground border-border mt-2 border-l-2 pl-3 text-[13px] leading-relaxed italic">
            “{item.detail}”
          </p>
        )}

        <MetaRow item={item} />
      </div>
    </li>
  );
}

function ActorLine({
  item,
  prefix,
}: {
  item: NotificationItem;
  prefix: string;
}) {
  // Creation with no owner yet → the honest "unclaimed" state rather than a
  // fabricated caller.
  if (item.type === "atlas.venue_created" && !item.actor) {
    return (
      <p className="text-muted-foreground mt-1.5 text-[12px]">
        <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
          Unclaimed
        </span>
      </p>
    );
  }
  if (!item.actor) return null;
  return (
    <p className="text-foreground/80 mt-1.5 text-[12px]">
      <span className="text-muted-foreground">{prefix} </span>
      <span className="font-medium">{item.actor}</span>
    </p>
  );
}

function MetaRow({ item }: { item: NotificationItem }) {
  const chips: React.ReactNode[] = [];
  const m = item.meta ?? {};

  if (item.type === "atlas.venue_created") {
    if (typeof m.listingType === "string") {
      chips.push(<Chip key="lt">{m.listingType}</Chip>);
    }
    if (typeof m.status === "string") {
      chips.push(<Chip key="st">{m.status}</Chip>);
    }
    if (m.enriched === true) {
      chips.push(
        <Chip key="en" tone="violet">
          <Sparkles className="h-3 w-3" /> enriched
        </Chip>,
      );
    }
  }

  if (item.type === "atlas.venue_enriched") {
    if (typeof m.detailsFields === "number" && m.detailsFields > 0) {
      chips.push(<Chip key="df">{m.detailsFields} detail fields</Chip>);
    }
    chips.push(
      <Chip key="hs" tone={m.hasSummary ? "violet" : "muted"}>
        {m.hasSummary ? "summary written" : "no summary"}
      </Chip>,
    );
  }

  if (item.type === "atlas.ownership_claimed") {
    if (typeof m.method === "string") {
      chips.push(
        <Chip key="me">{CLAIM_METHOD_LABEL[m.method] ?? m.method}</Chip>,
      );
    }
    if (typeof m.status === "string") {
      chips.push(<ClaimStatusChip key="cs" status={m.status} />);
    }
  }

  if (item.venue?.googlePlaceId) {
    chips.push(
      <a
        key="gmap"
        href={`https://www.google.com/maps/place/?q=place_id:${item.venue.googlePlaceId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium transition"
      >
        <ExternalLink className="h-3 w-3" /> Maps
      </a>,
    );
  }

  if (chips.length === 0) return null;
  return <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{chips}</div>;
}

function Chip({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "violet";
}) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    violet: "bg-violet-100 text-violet-700",
  } as const;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium " +
        tones[tone]
      }
    >
      {children}
    </span>
  );
}

function ClaimStatusChip({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="bg-secondary/15 text-secondary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
        <CheckCircle2 className="h-3 w-3" /> approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
        <XCircle className="h-3 w-3" /> rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-700 uppercase">
      <Clock className="h-3 w-3" /> pending
    </span>
  );
}
