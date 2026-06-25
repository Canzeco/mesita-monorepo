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

type TypeConfig = {
  label: string;
  shortLabel: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const TYPE_CONFIG: Record<NotificationType, TypeConfig> = {
  "atlas.venue_created": {
    label: "New venue created",
    shortLabel: "New venue",
    Icon: Building2,
  },
  "atlas.venue_enriched": {
    label: "Place enriched",
    shortLabel: "Enriched",
    Icon: Sparkles,
  },
  "atlas.ownership_claimed": {
    label: "Ownership claimed",
    shortLabel: "Claimed",
    Icon: BadgeCheck,
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
    <div className="-mx-4 mt-6 sm:-mx-6 sm:mt-8 lg:-mx-8">
      <div className="border-border bg-card/95 supports-[backdrop-filter]:bg-card/85 sticky top-0 z-30 border-y backdrop-blur-md">
        <div className="flex items-stretch overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((c) => {
            const Icon = c.Icon;
            return (
              <span
                key={c.key}
                title={c.live ? undefined : "Coming soon"}
                className={
                  "inline-flex shrink-0 items-center gap-1.5 border-r px-3 py-2.5 text-sm font-medium sm:px-4 " +
                  (c.live
                    ? "bg-secondary/10 text-secondary"
                    : "text-muted-foreground/50 cursor-not-allowed")
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {c.label}
                {!c.live && (
                  <span className="text-[10px] font-semibold tracking-wide uppercase">
                    soon
                  </span>
                )}
              </span>
            );
          })}

          <FilterSegment
            active={typeFilter === "all"}
            label="All"
            count={data.total}
            onClick={() => setTypeFilter("all")}
          />
          {TYPE_ORDER.map((t) => (
            <FilterSegment
              key={t}
              active={typeFilter === t}
              label={TYPE_CONFIG[t].shortLabel}
              count={data.counts[t] ?? 0}
              onClick={() => setTypeFilter(t)}
            />
          ))}

          <div className="ml-auto flex shrink-0 items-center gap-2 border-l px-3 py-2 sm:px-4">
            <span
              className="text-muted-foreground hidden text-[11px] sm:inline"
              suppressHydrationWarning
            >
              {updatedLabel}
            </span>
            <button
              type="button"
              onClick={refresh}
              disabled={pending}
              title="Refresh"
              className="text-muted-foreground hover:text-foreground hover:bg-muted/60 inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-50"
            >
              <RefreshCw className={"h-4 w-4 " + (pending ? "animate-spin" : "")} />
            </button>
          </div>
        </div>
      </div>

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
                ? "No notifications yet. They'll show up here as venues are created, enriched, and claimed."
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

function FilterSegment({
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
        "inline-flex shrink-0 items-center gap-1.5 border-r px-3 py-2.5 text-sm font-medium transition sm:px-4 " +
        (active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")
      }
    >
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

function NotificationRow({
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
    <li className="hover:bg-muted/30 flex gap-3 px-4 py-3.5 transition sm:gap-4 sm:px-5 sm:py-4">
      <span className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
            {cfg.label}
          </p>
          <time
            className="text-muted-foreground shrink-0 text-[11px]"
            title={formatAbsoluteUtc(item.occurredAt)}
            suppressHydrationWarning
          >
            {when}
          </time>
        </div>

        <p className="mt-1 truncate text-sm font-semibold">
          {venue?.name ?? "(venue removed)"}
          {venue?.categoryLabel && (
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              {venue.categoryLabel}
            </span>
          )}
        </p>

        {venue?.address && (
          <p className="text-muted-foreground mt-0.5 flex items-start gap-1 text-xs">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0 opacity-60" />
            <span className="min-w-0">{venue.address}</span>
          </p>
        )}

        <ActorLine item={item} />

        {item.detail && (
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            {item.detail}
          </p>
        )}

        <MetaRow item={item} />
      </div>
    </li>
  );
}

function ActorLine({ item }: { item: NotificationItem }) {
  if (item.type === "atlas.venue_created" && !item.actor) {
    return (
      <div className="mt-2">
        <MetaTag>Unclaimed</MetaTag>
      </div>
    );
  }
  if (!item.actor) return null;

  const prefix =
    item.type === "atlas.venue_created"
      ? "Owner"
      : item.type === "atlas.ownership_claimed"
        ? "Claimed by"
        : "By";

  return (
    <p className="text-muted-foreground mt-2 text-xs">
      {prefix}{" "}
      <span className="text-foreground font-medium">{item.actor}</span>
    </p>
  );
}

function MetaRow({ item }: { item: NotificationItem }) {
  const tags: React.ReactNode[] = [];
  const m = item.meta ?? {};

  if (item.type === "atlas.venue_created") {
    if (typeof m.listingType === "string") tags.push(<MetaTag key="lt">{m.listingType}</MetaTag>);
    if (typeof m.status === "string") tags.push(<MetaTag key="st">{m.status}</MetaTag>);
    if (m.enriched === true) tags.push(<MetaTag key="en">enriched</MetaTag>);
  }

  if (item.type === "atlas.venue_enriched") {
    if (typeof m.detailsFields === "number" && m.detailsFields > 0) {
      tags.push(<MetaTag key="df">{m.detailsFields} detail fields</MetaTag>);
    }
    tags.push(
      <MetaTag key="hs">{m.hasSummary ? "summary written" : "no summary"}</MetaTag>,
    );
  }

  if (item.type === "atlas.ownership_claimed") {
    if (typeof m.method === "string") {
      tags.push(
        <MetaTag key="me">{CLAIM_METHOD_LABEL[m.method] ?? m.method}</MetaTag>,
      );
    }
    if (typeof m.status === "string") {
      tags.push(<ClaimStatusTag key="cs" status={m.status} />);
    }
  }

  if (item.venue?.googlePlaceId) {
    tags.push(
      <a
        key="gmap"
        href={`https://www.google.com/maps/place/?q=place_id:${item.venue.googlePlaceId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[11px] font-medium transition"
      >
        <ExternalLink className="h-3 w-3" />
        Maps
      </a>,
    );
  }

  if (tags.length === 0) return null;
  return <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">{tags}</div>;
}

function MetaTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-muted text-muted-foreground inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium">
      {children}
    </span>
  );
}

function ClaimStatusTag({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="bg-secondary/10 text-secondary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium">
        <CheckCircle2 className="h-3 w-3" />
        approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium">
        <XCircle className="h-3 w-3" />
        rejected
      </span>
    );
  }
  return (
    <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium">
      <Clock className="h-3 w-3" />
      pending
    </span>
  );
}
