"use client";

import { useMemo } from "react";
import {
  Bookmark,
  CalendarCheck,
  CircleDollarSign,
  Facebook,
  Footprints,
  Instagram,
  Percent,
  Receipt,
  Star,
  Ticket,
} from "lucide-react";
import type { AdminPlace } from "../actions";
import { SectionCard } from "../ui";
import type { NotificationsPayload } from "../../global-performance/actions";

// Performance → Summary. The headline numbers for one place, above the
// reviews cards and the raw feed (Pato 2026-08-03: "include summary — mesita
// reviews, google reviews, instagram followers, facebook followers … some
// analytics").
//
// Form choice: these are a handful of current values, so this is a KPI ROW of
// stat tiles, not a chart — a one-bar bar chart per metric would be strictly
// worse. Every tile carries an icon AND a text label, so hue is never the
// only channel (which is what makes the categorical ramp's remaining
// near-pair legal; see the validator note in notification-config.ts).
//
// Two groups, because the numbers answer two different questions:
//   Reputation & reach — what the OUTSIDE world says (Mesita + Google stars,
//     IG/FB audience). Sourced from the place row (Enricher-populated).
//   App activity      — what MESITA did here. Derived from the same
//     notification feed rendered below, so the tiles and the rows can never
//     disagree; no extra endpoint.

type Tone = "indigo" | "rose" | "amber" | "emerald" | "sky" | "slate";

const TILE_TINT: Record<Tone, string> = {
  indigo: "bg-indigo-500/10 text-indigo-600",
  rose: "bg-rose-500/10 text-rose-600",
  amber: "bg-amber-500/10 text-amber-600",
  emerald: "bg-emerald-500/10 text-emerald-600",
  sky: "bg-sky-500/10 text-sky-600",
  slate: "bg-muted text-muted-foreground",
};

function compact(n: number): string {
  if (n < 1_000) return n.toLocaleString();
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000).toFixed(1)}K`;
}

function mxn(cents: number): string {
  const pesos = cents / 100;
  if (pesos >= 1_000_000) return `MX$${(pesos / 1_000_000).toFixed(1)}M`;
  if (pesos >= 1_000) return `MX$${(pesos / 1_000).toFixed(1)}K`;
  return `MX$${Math.round(pesos).toLocaleString()}`;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** One headline number. `hint` is the quiet second line (count, share, base). */
function Tile({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  tone: Tone;
  label: string;
  value: string;
  hint?: string | null;
}) {
  return (
    <div className="border-border bg-background flex flex-col gap-2 rounded-xl border p-3.5">
      <span className="flex items-center gap-2">
        <span
          className={
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg " +
            TILE_TINT[tone]
          }
        >
          {icon}
        </span>
        <span className="text-muted-foreground truncate text-xs font-medium">
          {label}
        </span>
      </span>
      {/* Proportional figures on purpose — tabular-nums is for COLUMNS of
          numbers, and makes a standalone display value look loose. */}
      <span className="text-foreground text-2xl leading-none font-semibold">
        {value}
      </span>
      <span className="text-muted-foreground min-h-[1rem] text-[11px] leading-none">
        {hint ?? ""}
      </span>
    </div>
  );
}

function Group({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
        {title}
      </p>
      {note ? (
        <p className="text-muted-foreground mt-1 text-[11px] leading-snug">
          {note}
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
    </div>
  );
}

export function PerformanceSummary({
  place,
  data,
}: {
  place: AdminPlace;
  data: NotificationsPayload;
}) {
  // ── Reputation & reach (place row) ────────────────────────────────────
  const mesitaCount = num(place.mesita_review_count) ?? 0;
  // Same honesty rule as ReviewsSection: stars only exist once someone has
  // actually reviewed — an unreviewed place must not render a fabricated 5.0.
  const mesitaStars = mesitaCount > 0 ? num(place.mesita_stars_overall) : null;
  const googleStars = num(place.google_stars_overall);
  const googleCount = num(place.google_review_count) ?? 0;
  const ig = num(place.instagram_followers_count);
  const fb = num(place.facebook_followers);

  // ── App activity (derived from the feed below) ────────────────────────
  const activity = useMemo(() => {
    const c = data.counts;
    const n = (t: string) => c[t] ?? 0;

    // Money lives in each paid ticket's meta, so it can only be summed over
    // the items actually returned — `counts` covers the whole filtered set
    // but carries no amounts. When the window truncated, say so rather than
    // presenting a partial sum as the total.
    let subtotal = 0;
    let discount = 0;
    let paidWithMoney = 0;
    for (const item of data.notifications) {
      if (item.type !== "rewards.ticket_paid") continue;
      const s = num(item.meta?.subtotalCents) ?? 0;
      const d = num(item.meta?.discountCents) ?? 0;
      if (s > 0) {
        subtotal += s;
        paidWithMoney += 1;
      }
      discount += d;
    }

    const visits = n("rewards.ticket_visit");
    const paid = n("rewards.ticket_paid");
    return {
      saves: n("consumer.place_saved"),
      tickets: n("rewards.ticket_created"),
      visits,
      paid,
      reservations: n("reservations.reservation_created"),
      reviews: n("rewards.review_submitted"),
      subtotal,
      discount,
      avgTicket: paidWithMoney > 0 ? subtotal / paidWithMoney : null,
      // Of the guests who showed a QR, how many closed a paid check.
      closeRate: visits > 0 ? Math.round((paid / visits) * 100) : null,
      truncated: data.total > data.notifications.length,
    };
  }, [data]);

  const empty =
    activity.saves === 0 &&
    activity.tickets === 0 &&
    activity.visits === 0 &&
    activity.paid === 0 &&
    activity.reservations === 0;

  return (
    <SectionCard
      icon={<Receipt className="h-4 w-4" />}
      tint="indigo"
      title="Summary"
      subtitle={`Headline numbers for ${place.name}. Reputation comes from the place profile; activity is computed from the feed below.`}
    >
      <div className="mt-5 flex flex-col gap-6">
        <Group title="Reputation & reach">
          <Tile
            icon={<Star className="h-3.5 w-3.5" />}
            tone="rose"
            label="Mesita reviews"
            value={mesitaStars != null ? mesitaStars.toFixed(1) : "—"}
            hint={
              mesitaCount > 0
                ? `${compact(mesitaCount)} review${mesitaCount === 1 ? "" : "s"}`
                : "No guest reviews yet"
            }
          />
          <Tile
            icon={<Star className="h-3.5 w-3.5" />}
            tone="amber"
            label="Google reviews"
            value={googleStars != null ? googleStars.toFixed(1) : "—"}
            hint={
              googleCount > 0 ? `${compact(googleCount)} reviews` : "Not scraped yet"
            }
          />
          <Tile
            icon={<Instagram className="h-3.5 w-3.5" />}
            tone="rose"
            label="Instagram"
            value={ig != null ? compact(ig) : "—"}
            hint={ig != null ? "followers" : "No IG channel linked"}
          />
          <Tile
            icon={<Facebook className="h-3.5 w-3.5" />}
            tone="sky"
            label="Facebook"
            value={fb != null ? compact(fb) : "—"}
            hint={fb != null ? "followers" : "No FB channel linked"}
          />
        </Group>

        <Group
          title="App activity"
          note={
            empty
              ? "Nothing yet — tiles fill in as guests save the place, open tickets and pay."
              : activity.truncated
                ? `Counts cover every matching event; money sums the ${data.notifications.length} loaded.`
                : undefined
          }
        >
          <Tile
            icon={<Bookmark className="h-3.5 w-3.5" />}
            tone="sky"
            label="Saves"
            value={compact(activity.saves)}
            hint="guests saved this place"
          />
          <Tile
            icon={<Ticket className="h-3.5 w-3.5" />}
            tone="indigo"
            label="Tickets"
            value={compact(activity.tickets)}
            hint={`${compact(activity.visits)} reached the venue`}
          />
          <Tile
            icon={<Footprints className="h-3.5 w-3.5" />}
            tone="amber"
            label="Visits"
            value={compact(activity.visits)}
            hint={
              activity.closeRate != null
                ? `${activity.closeRate}% closed a paid check`
                : "QR scanned at the venue"
            }
          />
          <Tile
            icon={<CircleDollarSign className="h-3.5 w-3.5" />}
            tone="emerald"
            label="Paid checks"
            value={compact(activity.paid)}
            hint="closed and honored"
          />
          <Tile
            icon={<Receipt className="h-3.5 w-3.5" />}
            tone="emerald"
            label="Influenced spend"
            value={activity.subtotal > 0 ? mxn(activity.subtotal) : "—"}
            hint="subtotals Mesita brought in"
          />
          <Tile
            icon={<Percent className="h-3.5 w-3.5" />}
            tone="rose"
            label="Discount given"
            value={activity.discount > 0 ? mxn(activity.discount) : "—"}
            hint="what the place funded"
          />
          <Tile
            icon={<Receipt className="h-3.5 w-3.5" />}
            tone="slate"
            label="Avg ticket"
            value={activity.avgTicket != null ? mxn(activity.avgTicket) : "—"}
            hint="per paid check"
          />
          <Tile
            icon={<CalendarCheck className="h-3.5 w-3.5" />}
            tone="slate"
            label="Reservations"
            value={compact(activity.reservations)}
            hint="requested through Mesita"
          />
        </Group>
      </div>
    </SectionCard>
  );
}
