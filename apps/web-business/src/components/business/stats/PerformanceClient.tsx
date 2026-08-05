"use client";

// v3d Performance (MESITA-852) — "the place's whole record, not a metrics
// page". Three bands:
//
//   1. Summary   what the program did, and what it cost.
//   2. Produced  what the guests MADE — the output the discounts bought.
//   3. Activity  the per-place feed, newest first.
//
// Two invariants this file must never break:
//   • Nothing class-shaped. A place never learns which guests were Premium
//     (blended-rate privacy, Product Rules §A) — the EF doesn't send it and
//     nothing here asks for it. "By segment" is reported BY ACTION.
//   • Never invent a number. This database records no views and no swipes,
//     so the funnel starts at "saved" and the tab SAYS the earlier stages
//     aren't tracked rather than rendering a zero a place might price
//     against. Averages state how many bills they're over, and flag when the
//     guest typed the amount (v3b provenance).

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Bookmark,
  CalendarCheck,
  Camera,
  CircleDollarSign,
  Footprints,
  Loader2,
  RefreshCw,
  Repeat,
  Star,
  Ticket,
  Users,
  UtensilsCrossed,
} from "lucide-react";

import { EmptyState, Section } from "@/components/shared";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import {
  getPlacePerformance,
  type PerformanceFeedItem,
  type PlacePerformance,
} from "@/lib/api/performance";
import { cn, errMsg } from "@/lib/utils";

function money(cents: number | null | undefined, currency = "MXN"): string {
  if (cents == null) return "—";
  const prefix = currency === "MXN" ? "MX$" : "$";
  return `${prefix}${Math.round(cents / 100).toLocaleString("en-US")}`;
}

const FEED_META: Record<
  string,
  { label: string; Icon: typeof Ticket; tone: string }
> = {
  "consumer.place_saved": {
    label: "Saved your place",
    Icon: Bookmark,
    tone: "bg-sky-500/10 text-sky-600",
  },
  "rewards.ticket_created": {
    label: "Opened a ticket",
    Icon: Ticket,
    tone: "bg-indigo-500/10 text-indigo-600",
  },
  "rewards.ticket_visit": {
    label: "Showed the QR at the table",
    Icon: Footprints,
    tone: "bg-amber-500/10 text-amber-600",
  },
  // v3b renamed this: the close is "marks as done", not a payment event.
  "rewards.ticket_closed": {
    label: "Visit closed",
    Icon: BadgeCheck,
    tone: "bg-emerald-500/10 text-emerald-600",
  },
  "rewards.review_submitted": {
    label: "Left a Mesita review",
    Icon: Star,
    tone: "bg-rose-500/10 text-rose-600",
  },
  "reservations.reservation_created": {
    label: "Requested a reservation",
    Icon: CalendarCheck,
    tone: "bg-violet-500/10 text-violet-600",
  },
};

function timeAgo(iso: string): string {
  const mins = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function PerformanceClient({
  projectId,
  initialData = null,
  initialError = null,
}: {
  projectId: string;
  /** SSR-prefetched payload — kills the client waterfall on first paint. */
  initialData?: PlacePerformance | null;
  initialError?: string | null;
}) {
  const supabase = useBrowserSupabase();
  const [data, setData] = useState<PlacePerformance | null>(initialData);
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(!initialData && !initialError);

  // Only fetch on the client when the server didn't already hand us data
  // (or when projectId changes after mount). Refresh stays a handler.
  useEffect(() => {
    if (initialData || initialError) return;
    let active = true;
    (async () => {
      try {
        const next = await getPlacePerformance(supabase, projectId);
        if (!active) return;
        setData(next);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(errMsg(err, "Could not load performance."));
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [supabase, projectId, initialData, initialError]);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setData(await getPlacePerformance(supabase, projectId));
    } catch (err) {
      setError(errMsg(err, "Could not load performance."));
    } finally {
      setBusy(false);
    }
  }, [supabase, projectId]);

  if (busy && !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <Section title="Performance">
        <p className="text-destructive text-sm">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="border-border text-foreground hover:bg-muted mt-1 inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
      </Section>
    );
  }

  if (!data) return null;

  const { summary, content, feed } = data;
  const cur = summary.currency;
  const softAmounts = summary.consumerReportedCount > 0;
  const mesitaTotal = content.mesitaReviewCount ?? content.mesitaReviews.length;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Band 1 · Summary ─────────────────────────────────────────── */}
      <Section
        title="Your record"
        description="What the Mesita program did at this place, and what it cost."
        right={
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-semibold transition disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
            Refresh
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat
            Icon={CircleDollarSign}
            label="Influenced spend"
            value={money(summary.influencedCents, cur)}
            meta={`over ${summary.billedCount} recorded bill${summary.billedCount === 1 ? "" : "s"}`}
          />
          <Stat
            Icon={Ticket}
            label="Average ticket"
            value={money(summary.avgTicketCents, cur)}
            meta={softAmounts
              ? `${summary.consumerReportedCount} typed by the guest`
              : "from your entered bills"}
          />
          <Stat
            Icon={BadgeCheck}
            label="Discounts given"
            value={money(summary.discountCents, cur)}
            meta="what the program cost you"
          />
          <Stat
            Icon={Users}
            label="Guests"
            value={String(summary.guests)}
            meta={`${summary.repeatGuests} came back`}
          />
          <Stat
            Icon={Repeat}
            label="Repeat rate"
            value={summary.guests > 0
              ? `${Math.round((summary.repeatGuests / summary.guests) * 100)}%`
              : "—"}
            meta="guests with more than one visit"
          />
          <Stat
            Icon={Footprints}
            label="Visits"
            value={String(summary.honored)}
            meta={
              summary.cancelled > 0
                ? `${summary.ticketsOpened} opened · ${summary.cancelled} cancelled`
                : `${summary.ticketsOpened} tickets opened`
            }
          />
        </div>

        {/* The funnel — honest about where measurement actually begins. */}
        <div className="border-border/60 mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-xl border px-3 py-2.5 text-xs">
          <FunnelStep label="Saved" value={summary.saved} />
          <FunnelArrow />
          <FunnelStep label="Ticket opened" value={summary.ticketsOpened} />
          <FunnelArrow />
          <FunnelStep label="QR shown" value={summary.visits} />
          <FunnelArrow />
          <FunnelStep label="Visit closed" value={summary.honored} />
        </div>
        <p className="text-muted-foreground text-[11px] leading-snug">
          Views and swipes aren&apos;t tracked yet, so the funnel starts where
          the data is real.
        </p>

        {/* "Redemption by segment" — by ACTION. Never by class. */}
        <div className="flex flex-wrap gap-2">
          <Pill Icon={Footprints} label="First visits" value={summary.byAction.welcome} />
          <Pill Icon={Camera} label="With a story" value={summary.byAction.story} />
          <Pill Icon={Star} label="With a Google review" value={summary.byAction.review} />
        </div>
      </Section>

      {/* ── Band 2 · What the guests produced ───────────────────────── */}
      <Section
        title="What your guests produced"
        description="The output the discounts bought."
      >
        <div className="flex flex-wrap gap-2">
          <Pill Icon={Camera} label="Instagram stories" value={content.storiesPosted} />
          <Pill Icon={Star} label="Google reviews" value={content.googleReviews} />
          <Pill
            Icon={UtensilsCrossed}
            label="Mesita reviews"
            value={mesitaTotal}
          />
        </div>
        <p className="text-muted-foreground text-[11px] leading-snug">
          Stories and Google reviews are declared by the guest at the table —
          Mesita doesn&apos;t store the post itself, so the count is the record.
        </p>

        {content.mesitaReviews.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed className="text-muted-foreground h-5 w-5" />}
            title="No Mesita reviews yet"
            description="Guests rate food, service, ambiance and value right after a visit."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {content.mesitaReviews.map((r) => (
              <article
                key={r.id}
                className="border-border/60 rounded-xl border px-3.5 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-foreground text-[13px] font-semibold">
                    {r.guestFirstName ?? "A guest"}
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    {timeAgo(r.createdAt)}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  {(
                    [
                      ["Overall", r.overall],
                      ["Food", r.food],
                      ["Service", r.service],
                      ["Ambiance", r.ambiance],
                      ["Value", r.value],
                    ] as const
                  ).map(([label, v]) =>
                    v == null ? null : (
                      <span
                        key={label}
                        className="text-muted-foreground text-[11.5px]"
                      >
                        {label}{" "}
                        <span className="text-foreground font-bold tabular-nums">
                          {v}
                        </span>
                      </span>
                    )
                  )}
                </div>
                {r.comments?.trim() ? (
                  <p className="text-foreground/80 mt-1.5 text-[12.5px] leading-snug">
                    “{r.comments.trim()}”
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </Section>

      {/* ── Band 3 · Activity ───────────────────────────────────────── */}
      <Section
        title="Activity"
        description="Everything guests did here, newest first. Booking ops live on Reservations."
      >
        {feed.length === 0 ? (
          <EmptyState
            icon={<Ticket className="text-muted-foreground h-5 w-5" />}
            title="Nothing yet"
            description="Saves, tickets, visits and reservations will show up here."
          />
        ) : (
          <ol className="flex flex-col gap-1.5">
            {feed.map((item) => (
              <FeedRow key={item.id} item={item} currency={cur} />
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

function Stat({
  Icon,
  label,
  value,
  meta,
}: {
  Icon: typeof Ticket;
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="border-border/60 rounded-xl border px-3 py-2.5">
      <span className="text-muted-foreground flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wide uppercase">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <p className="text-foreground mt-1 text-[19px] leading-none font-bold tabular-nums">
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-[10.5px] leading-tight">
        {meta}
      </p>
    </div>
  );
}

function FunnelStep({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-foreground text-[13px] font-bold tabular-nums">
        {value}
      </span>
      <span className="text-muted-foreground text-[11px]">{label}</span>
    </span>
  );
}

function FunnelArrow() {
  return <span className="text-muted-foreground/50 text-[11px]">→</span>;
}

function Pill({
  Icon,
  label,
  value,
}: {
  Icon: typeof Ticket;
  label: string;
  value: number;
}) {
  return (
    <span className="bg-muted/50 text-foreground inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold">
      <Icon className="text-muted-foreground h-3.5 w-3.5" />
      {label}
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

function FeedRow({
  item,
  currency,
}: {
  item: PerformanceFeedItem;
  currency: string;
}) {
  const meta = FEED_META[item.type];
  if (!meta) return null;
  const { Icon } = meta;

  const tags: string[] = [];
  if (item.type === "rewards.ticket_closed") {
    const pct = item.meta.discountPercent;
    if (typeof pct === "number" && pct > 0) tags.push(`−${pct}%`);
    const amount = item.meta.amountCents;
    if (typeof amount === "number" && amount > 0) {
      tags.push(money(amount, currency));
    }
    // v3b provenance — a guest-typed amount is a record, not a confirmation.
    if (item.meta.billSource === "consumer") tags.push("guest-reported");
  }
  if (item.type === "rewards.review_submitted") {
    const overall = item.meta.overall;
    if (typeof overall === "number") tags.push(`★ ${overall}`);
  }
  if (item.type === "reservations.reservation_created") {
    if (typeof item.meta.status === "string") tags.push(item.meta.status);
    if (typeof item.meta.partySize === "number") {
      tags.push(`party of ${item.meta.partySize}`);
    }
  }

  return (
    <li className="flex items-center gap-2.5">
      <span
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
          meta.tone,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate text-[12.5px] font-medium">
          {meta.label}
        </span>
        {tags.length > 0 ? (
          <span className="text-muted-foreground block truncate text-[11px]">
            {tags.join(" · ")}
          </span>
        ) : null}
      </span>
      <span className="text-muted-foreground shrink-0 text-[11px]">
        {timeAgo(item.occurredAt)}
      </span>
    </li>
  );
}
