"use client";

// Billing, as the place sees it (MESITA-3128; its own page under Manage since
// MESITA-3160). Since MESITA-3166 (Design D1–D13) it answers three things in
// order: the status block (the level and until when, a timeline of what runs,
// one money line, one button), one card "What's running" (each block of
// Refill days and the subscription as rows) and one card "Payment" (the
// payer's card, then every charge). Premier sells the plans; Billing shows the
// schedule and the money. Every amount, date and state is the server's
// (business-web-get-billing); this file only formats, in the place's time
// zone.

import Link from "next/link";
import { useState } from "react";
import { CreditCard } from "lucide-react";
import { startPremier, type PlaceBilling } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { billingHref, placeTabHref, returnUrl } from "@/lib/routes";
import { FREE_PLAN, planName } from "@/lib/plans";
import { REFILL_ORIGIN } from "@/lib/premier-origin";
import { CodeRow } from "./CodeRow";

type Rank = 1 | 2;
const FACTOR: Record<number, string> = { 1: "2X", 2: "5X" };
const PLAN_OF: Record<Rank, "boost_2x" | "boost_5x"> = { 1: "boost_2x", 2: "boost_5x" };
const STATUS: Record<PlaceBilling["charges"][number]["status"], string> = {
  paid: "Paid",
  declined: "Declined",
  charging: "Charging",
};
const DAY_MS = 86_400_000;

/** What Stripe's return from Update card did (page.tsx reads it). */
export type CardReturn = "saved" | "pending" | "unchanged" | null;
const RETURN_LINE: Record<Exclude<CardReturn, null>, string> = {
  saved: "Your card is saved.",
  pending: "Confirming your card…",
  unchanged: "Card not changed.",
};

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 });
}

function brand(b: string): string {
  return b === "amex" ? "American Express" : b.charAt(0).toUpperCase() + b.slice(1);
}

/** Dates in the place's time zone ("Dec 3", with the year when it is not
 *  this year's), and how many calendar days away they are there. */
function dates(tz: string, today: string) {
  const year = today.slice(0, 4);
  const local = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const day = (iso: string | null | undefined) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      timeZone: tz,
      month: "short",
      day: "numeric",
      ...(local(iso).slice(0, 4) === year ? {} : { year: "numeric" }),
    });
  };
  /** A YYYY-MM-DD date (already in the place's time zone). */
  const plainDay = (ymd: string) =>
    new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", ...(ymd.slice(0, 4) === year ? {} : { year: "numeric" }) });
  const daysAway = (iso: string) => Math.round((Date.parse(local(iso)) - Date.parse(today)) / DAY_MS);
  return { day, plainDay, daysAway };
}

export function BillingPanel({
  placeId,
  billing,
  error: loadError,
  returned,
  plans,
}: {
  placeId: string;
  billing: PlaceBilling | null;
  error: string | null;
  returned: CardReturn;
  /** The Plans card (MESITA-3173), right under the status. */
  plans?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!billing) {
    return (
      <Card>
        <p className="font-semibold">Billing didn&apos;t load.</p>
        <p className="text-muted-foreground mt-1 text-sm">{loadError}</p>
      </Card>
    );
  }

  async function updateCard() {
    setBusy(true);
    setError(null);
    const r = await startPremier({ placeId, updateCard: true, returnUrl: returnUrl(placeTabHref(placeId, "billing")) });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    if (r.data.url) window.location.assign(r.data.url);
  }

  const { level, refill, subscription: sub, payer, card, charges, keep, moved } = billing;
  const { day, plainDay, daysAway } = dates(billing.timezone, billing.today);
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: billing.timezone, hour: "numeric", minute: "2-digit" });
  const you = payer === "you";
  const empty = level.tier === 0 && refill.length === 0 && !sub && charges.length === 0;

  // ── Status block ── The plan is the headline; the Premier level it (or
  // Refill days) gives is the first line under it.
  const planLine = sub ? planName(sub.tier) : FREE_PLAN;
  let levelLine = level.tier > 0 ? `Premier ${FACTOR[level.tier]}` : null;
  if (levelLine && level.until) {
    const left = level.days_left;
    levelLine +=
      left === null ? ` until ${day(level.until)}` : left === 0 ? ` · ends today` : ` · ends in ${left} day${left === 1 ? "" : "s"} (${day(level.until)})`;
  }

  const money: string[] = [];
  if (sub) {
    const amount = you ? ` ${usd(sub.next_charge_cents)}` : "";
    if (sub.state === "charging") money.push("A charge is being taken now.");
    else if (sub.state === "paused" && sub.resumes_at && sub.next_charge_at) {
      money.push(
        daysAway(sub.resumes_at) === daysAway(sub.next_charge_at)
          ? `Paused while a Boost runs — resumes and charges${amount} on ${day(sub.next_charge_at)}.`
          : `Paused while a Boost runs — resumes ${day(sub.resumes_at)}, next charge${amount} on ${day(sub.next_charge_at)}.`,
      );
    } else if (sub.state === "waiting" && sub.next_charge_at) {
      money.push(
        sub.early_start
          ? `${planName(sub.tier)} starts when the Boost ends on ${day(sub.next_charge_at)}: first charge${amount}.`
          : daysAway(sub.next_charge_at) <= 0
            ? `Next charge${amount} in the next few minutes.`
            : `Next charge${amount} on ${day(sub.next_charge_at)}, when the Boost ends.`,
      );
    } else if (sub.next_charge_at) money.push(`Next charge${amount} on ${day(sub.next_charge_at)}.`);
    if (!you) money.push("Paid by another member of your team.");
  } else if (keep) {
    money.push(`Keep Premier ${FACTOR[keep.tier]} with ${planName(keep.tier)} — first charge ${usd(keep.price_cents)} on ${day(keep.ends_at)}, the day the Boost ends.`);
  } else if (empty) {
    money.push("Your place ranks like every other place.");
  } else {
    money.push("Nothing scheduled to charge.");
    const from = level.tier > 0 ? billing.subscribe_from[level.tier as Rank] : undefined;
    if (from) money.push(`You can keep Premier ${FACTOR[level.tier]} with ${planName(level.tier)} from ${plainDay(from)}.`);
  }

  const movedLine = moved
    ? `Moved from ${day(moved.from)} to ${day(moved.to)} by ${moved.days} day${moved.days === 1 ? "" : "s"} · ${REFILL_ORIGIN[moved.origin]} on ${day(moved.granted_at)}.`
    : null;
  const cardLine =
    billing.card_expires_before_charge && card && sub?.next_charge_at
      ? `Your card expires ${String(card.exp_month).padStart(2, "0")}/${String(card.exp_year).slice(-2)}, before the next charge on ${day(sub.next_charge_at)}.`
      : null;

  // One button (D1): Update card → Keep <tier> → See plans.
  const buttonClass =
    "inline-flex h-11 w-full items-center justify-center rounded-full px-5 text-sm font-semibold disabled:opacity-60 sm:w-auto";
  const button = cardLine ? (
    <button type="button" disabled={busy} onClick={() => void updateCard()} className={`bg-foreground text-background ${buttonClass}`}>
      {busy ? "Opening…" : "Update card"}
    </button>
  ) : keep ? (
    <Link href={billingHref(placeId, { plan: PLAN_OF[keep.tier] })} className={`bg-foreground text-background ${buttonClass}`}>
      Keep Premier {FACTOR[keep.tier]}
    </Link>
  ) : (
    <Link
      href={billingHref(placeId, { plan: sub ? PLAN_OF[sub.tier] : null })}
      className={`${empty ? "bg-foreground text-background" : "border-border hover:bg-muted border"} ${buttonClass}`}
    >
      See plans
    </Link>
  );

  // ── What's running ──
  const subRow = sub ? (
    <Row
      badge={sub.tier}
      outlined
      what={you ? `${planName(sub.tier)} · ${usd(sub.amount_cents)} a ${sub.interval}` : `${planName(sub.tier)} · paid by your team`}
      when=""
      state={
        sub.state === "charging"
          ? "Charging"
          : sub.state === "paused" && sub.resumes_at
            ? `Paused until ${day(sub.resumes_at)}`
            : sub.state === "waiting" && sub.next_charge_at
              ? `Starts ${day(sub.next_charge_at)}`
              : sub.next_charge_at
                ? `Renews ${day(sub.next_charge_at)}`
                : "Running"
      }
    />
  ) : null;

  return (
    <section id="billing" className="flex scroll-mt-6 flex-col gap-4">
      {returned ? (
        <p role="status" className="border-border bg-card rounded-xl border px-4 py-3 text-sm">
          {RETURN_LINE[returned]}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 py-1">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-display text-2xl font-semibold tracking-tight">{planLine}</p>
            {levelLine ? <p className="text-muted-foreground mt-1 text-sm">{levelLine}</p> : null}
            {money.map((line) => (
              <p key={line} className="text-muted-foreground mt-1 text-sm">
                {line}
              </p>
            ))}
            {movedLine ? <p className="text-muted-foreground mt-1 text-sm">{movedLine}</p> : null}
            {cardLine ? <p className="mt-1 text-sm font-medium text-(--brand-pink-700)">{cardLine}</p> : null}
          </div>
          <div className="shrink-0">{button}</div>
        </div>
        <Timeline billing={billing} day={day} />
        {error ? (
          <p className="text-destructive text-sm" aria-live="polite">
            {error}
          </p>
        ) : null}
      </div>

      {plans}

      {/* "Have a code?" is the card's last row (D1); with nothing running it
          stands alone, open, right below the status (D4; MESITA-3167). */}
      <Card className="flex flex-col p-0 sm:p-0">
        {refill.length > 0 || sub ? <h2 className="px-5 pt-4 pb-2 font-semibold">What&apos;s running</h2> : null}
        <div className="divide-border divide-y">
          {refill.map((r) => (
            <Row
              key={r.id}
              badge={r.tier}
              what={REFILL_ORIGIN[r.origin]}
              when={`${r.state === "running" ? "Now" : day(r.starts_at)} – ${day(r.ends_at)}`}
              state={r.state === "running" ? "Running" : "Next"}
            />
          ))}
          {subRow}
          <CodeRow placeId={placeId} you={you} day={day} time={time} />
        </div>
      </Card>

      {payer || charges.length > 0 ? (
        <Card className="flex flex-col p-0 sm:p-0">
          <h2 className="px-5 pt-4 pb-2 font-semibold">Payment</h2>
          <div className="divide-border divide-y">
            {you ? (
              <div className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <CreditCard className="text-muted-foreground size-5 shrink-0" aria-hidden />
                  {card ? (
                    <span className="font-medium">
                      {brand(card.brand)} •••• {card.last4}
                      <span className="text-muted-foreground ml-2 text-sm font-normal">
                        expires {String(card.exp_month).padStart(2, "0")}/{String(card.exp_year).slice(-2)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm">Your card on file</span>
                  )}
                </div>
                {cardLine ? null : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void updateCard()}
                    className="border-border hover:bg-muted h-11 rounded-full border px-4 text-sm font-semibold disabled:opacity-60"
                  >
                    {busy ? "Opening…" : "Update card"}
                  </button>
                )}
              </div>
            ) : payer === "team" ? (
              <p className="px-5 py-3 text-sm">Paid by another member of your team. Only they see and change the card.</p>
            ) : null}
            {charges.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {day(c.at)} · {planName(c.tier)}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {day(c.starts_at)} – {day(c.ends_at)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums">{usd(c.amount_cents)}</p>
                  <p className={c.status === "declined" ? "text-destructive text-sm" : "text-muted-foreground text-sm"}>{STATUS[c.status]}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </section>
  );
}

/** A tier mark: 5X solid pink, 2X pale pink; a subscription outlined. */
function TierBadge({ tier, outlined }: { tier: number; outlined?: boolean }) {
  const look = outlined
    ? "border-foreground border bg-transparent text-foreground"
    : tier === 2
      ? "bg-(--brand-pink-600) text-white"
      : "bg-(--brand-pink-100) text-(--brand-pink-800)";
  return <span className={`type-label inline-flex h-6 min-w-9 items-center justify-center rounded-full px-2 font-semibold ${look}`}>{FACTOR[tier]}</span>;
}

function Row({ badge, outlined, what, when, state }: { badge: number; outlined?: boolean; what: string; when: string; state: string }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <TierBadge tier={badge} outlined={outlined} />
        <span className="min-w-0 truncate font-medium">{what}</span>
      </div>
      <div className="text-muted-foreground flex items-center justify-between gap-4 text-sm sm:justify-end">
        {when ? <span className="tabular-nums">{when}</span> : null}
        <span className="text-foreground font-medium">{state}</span>
      </div>
    </div>
  );
}

/** The schedule as one bar from now (D1): 5X, 2X, then the subscription
 *  outlined. The same facts are the rows below, so the bar is hidden from
 *  screen readers. */
function Timeline({ billing, day }: { billing: PlaceBilling; day: (iso: string | null | undefined) => string }) {
  const now = Date.parse(billing.now);
  type Seg = { from: number; to: number; kind: "5x" | "2x" | "sub" };
  const segs: Seg[] = billing.refill.map((r) => ({
    from: Math.max(now, Date.parse(r.starts_at)),
    to: Date.parse(r.ends_at),
    kind: r.tier === 2 ? "5x" : "2x",
  }));
  const sub = billing.subscription;
  if (sub?.next_charge_at) {
    const charge = Date.parse(sub.next_charge_at);
    if (sub.state === "paused" && sub.resumes_at) segs.push({ from: Date.parse(sub.resumes_at), to: charge, kind: "sub" });
    else if (sub.state === "running") segs.push({ from: now, to: charge, kind: "sub" });
  }
  const live = segs.filter((s) => s.to > s.from);
  if (live.length === 0) return null;
  const end = Math.max(...live.map((s) => s.to));
  // Waiting for a first charge: an open tail after the Refill days.
  const tail = sub && sub.state === "waiting" ? (end - now) * 0.12 : 0;
  const span = end + tail - now;
  const pct = (t: number) => `${(((t - now) / span) * 100).toFixed(2)}%`;
  const joins = [...new Set(live.map((s) => s.to))].sort((a, b) => a - b);
  const shown: number[] = [];
  for (const t of joins) if (!shown.length || (t - shown[shown.length - 1]) / span > 0.18) shown.push(t);
  const look: Record<Seg["kind"], string> = {
    "5x": "bg-(--brand-pink-500)",
    "2x": "bg-(--brand-pink-200)",
    sub: "border-foreground border bg-transparent",
  };
  return (
    <div aria-hidden className="flex flex-col gap-1">
      <div className="bg-muted relative h-3 w-full overflow-hidden rounded-full">
        {live.map((s, i) => (
          <span
            key={i}
            className={`absolute inset-y-0 rounded-full ${look[s.kind]}`}
            style={{ left: pct(s.from), width: `calc(${pct(s.to)} - ${pct(s.from)})` }}
          />
        ))}
        {tail ? (
          <span className="border-foreground absolute inset-y-0 right-0 rounded-full border border-dashed" style={{ left: pct(end) }} />
        ) : null}
        <span className="bg-foreground absolute inset-y-0 left-0 w-0.5" />
      </div>
      <div className="text-muted-foreground relative h-4 text-xs">
        <span className="absolute left-0">Now</span>
        {shown.map((t) => (
          <span key={t} className="absolute -translate-x-full whitespace-nowrap" style={{ left: pct(t) }}>
            {day(new Date(t).toISOString())}
          </span>
        ))}
      </div>
    </div>
  );
}
