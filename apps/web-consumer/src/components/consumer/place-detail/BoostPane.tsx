"use client";

import { Fragment, useState } from "react";
import { BadgeCheck, Loader2, XCircle } from "lucide-react";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import {
  RowDivider,
  SettingsGroup,
} from "@/components/consumer/me/settings-rows";
import {
  apiCancelBoost,
  apiStartBoost,
  tierLabel,
  BOOST_TIERS,
  money,
  shortDate,
  type BoostInterval,
  type BoostQuote,
  type BoostTier,
  type MyPledge,
  type PlaceBoost,
} from "@/lib/api/boost";
import { MAP_PREMIER_PIN_COLOR } from "@/lib/map-defaults";
import type { PlaceDetail } from "@/lib/place-detail";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import {
  ERROR_BOX_CLASS,
  PRIMARY_BUTTON_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

// THE PREMIER TAB (MESITA-2995; Premier MESITA-2925, the place's fourth tab
// MESITA-2861). Pato, 2026-10-28: many guests pledge for one place; only
// the top pledge is charged, and if its card fails the next one pays — the
// others are backups; upgrading takes the unused days off the new price.
// Pato, 2026-10-29 (MESITA-3063): "make this cleaner … multiple people can
// be subscribed … list the people who is paying", and sell two plans by
// what the place gets, the 2X/5X priority only in the small print.
//
// One card, three parts: where the place stands (only when Premier), who's
// paying (named: "You", @handle or a first name, never an email), then the
// two plans with ONE price line and ONE button. Every amount, date and
// position is the server's (consumer-web-get-premier); nothing here
// computes money. Premier is paid ranking priority: it never verifies the
// place and never promises views.

const INTERVAL_WORD: Record<BoostInterval, string> = {
  month: "month",
  year: "year",
};

export function BoostPane({
  place,
  boost,
  loading,
  failed,
  onRetry,
  onChanged,
}: {
  place: PlaceDetail;
  boost: PlaceBoost | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onChanged: () => void;
}) {
  const getSupabase = useLazyBrowserSupabase();
  const [interval, setBillingInterval] = useState<BoostInterval>("month");
  const [picked, setPicked] = useState<BoostTier | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const period = boost?.period ?? null;
  const line = boost?.line ?? [];
  const mine = boost?.mine ?? null;
  const live = (boost?.tier ?? 0) > 0;
  const q = picked && boost?.quotes ? boost.quotes[picked][interval] : null;

  async function pledge() {
    if (!picked || starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const res = await apiStartBoost(getSupabase(), {
        placeId: place.id,
        tier: picked,
        interval,
        returnUrl: `${window.location.origin}${window.location.pathname}`,
      });
      if (res.url) {
        window.location.assign(res.url);
        return;
      }
      toast(
        res.outcome === "confirmed"
          ? "You're paying for Premier now"
          : "Your pledge is updated",
      );
      setPicked(null);
      setStarting(false);
      onChanged();
    } catch (err) {
      setStartError(errMsg(err, "Couldn't open checkout. Try again."));
      setStarting(false);
    }
  }

  async function confirmLeave() {
    if (!mine || leaveBusy) return;
    setLeaveBusy(true);
    setLeaveError(null);
    try {
      await apiCancelBoost(getSupabase(), mine.id);
      setLeaving(false);
      toast("You left the line");
      onChanged();
    } catch (err) {
      setLeaveError(errMsg(err, "Couldn't leave. Try again."));
    } finally {
      setLeaveBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 py-2" aria-labelledby="boost-title">
      <div className="border-border bg-card flex flex-col rounded-2xl border">
        {/* Where the place stands: one line, only when there is news. */}
        {!loading && (period || boost?.renewing || line.length > 0) && (
          <div
            className="border-border flex items-center gap-2 border-b px-4 py-3 text-sm"
            aria-live="polite"
          >
            <span
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full",
                live ? "" : "bg-muted-foreground",
              )}
              style={
                live ? { backgroundColor: MAP_PREMIER_PIN_COLOR } : undefined
              }
              aria-hidden
            />
            <span className="font-semibold">{statusLine(boost)}</span>
          </div>
        )}

        {/* Who's paying. */}
        <div className="flex flex-col gap-2 p-4">
          <h2 id="boost-title" className="type-eyebrow text-muted-foreground">
            Who&apos;s paying
          </h2>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : line.length > 0 ? (
            <>
              <SettingsGroup>
                {line.map((row, i) => (
                  <Fragment key={`${row.role}-${row.position}`}>
                    {i > 0 && <RowDivider />}
                    <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {row.name}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {tierLabel(row.tier)} ·{" "}
                          {row.interval === "year" ? "Yearly" : "Monthly"}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
                          row.role === "payer"
                            ? "bg-foreground text-white"
                            : "border-border text-foreground border",
                        )}
                      >
                        {row.role === "payer"
                          ? "Paying now"
                          : `Backup ${row.position}`}
                      </span>
                    </div>
                  </Fragment>
                ))}
              </SettingsGroup>
              {(boost?.more ?? 0) > 0 && (
                <p className="text-muted-foreground text-xs">
                  and {boost!.more} more{" "}
                  {boost!.more === 1 ? "backup" : "backups"}
                </p>
              )}
              <p className="text-muted-foreground text-xs leading-relaxed">
                Only the one paying now is charged. If they stop, the next
                backup pays.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm leading-relaxed">
              {period?.granted
                ? "Nobody yet. Join now and you pay when Mesita's grant ends."
                : "Nobody yet. You'd be the first."}
            </p>
          )}
          {mine && mine.status !== "ended" && (
            <YourPledge
              mine={mine}
              period={period}
              onLeave={() => setLeaving(true)}
            />
          )}
        </div>

        {/* The two plans. */}
        <div className="border-border flex flex-col gap-3 border-t p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="type-eyebrow text-muted-foreground">
              {mine && mine.status !== "ended"
                ? "Change your plan"
                : "Make it Premier"}
            </h3>
            <div
              className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1"
              role="radiogroup"
              aria-label="Billing"
            >
              {(["month", "year"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={interval === v}
                  onClick={() => setBillingInterval(v)}
                  className={cn(
                    "min-h-9 rounded-md px-3 text-xs font-semibold transition",
                    interval === v
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {v === "month" ? "Monthly" : "Yearly −2 mo"}
                </button>
              ))}
            </div>
          </div>
          <div
            className="flex flex-col gap-2"
            role="radiogroup"
            aria-label="Premier plan"
          >
            {BOOST_TIERS.map((t) => {
              const tq = boost?.quotes?.[t.key][interval];
              const on = picked === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setPicked(t.key);
                    setStartError(null);
                  }}
                  className={cn(
                    "flex min-h-16 items-center gap-3 rounded-xl border px-4 py-3 text-left transition active:scale-[0.99]",
                    on
                      ? "border-foreground ring-foreground ring-1"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                      on ? "border-foreground" : "border-border",
                    )}
                    aria-hidden
                  >
                    {on && (
                      <span className="bg-foreground h-2.5 w-2.5 rounded-full" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold">
                      {t.label}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {t.blurb}
                    </span>
                  </span>
                  {tq && (
                    <span className="text-sm font-semibold whitespace-nowrap">
                      {money(tq.price_cents)}
                      <span className="text-muted-foreground font-normal">
                        /{interval === "year" ? "yr" : "mo"}
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {picked && (
            <div className="flex flex-col gap-2">
              {startError && <p className={ERROR_BOX_CLASS}>{startError}</p>}
              {boost?.quotes && q && (
                <button
                  type="button"
                  onClick={() => void pledge()}
                  disabled={starting}
                  className={cn(
                    PRIMARY_BUTTON_CLASS,
                    "inline-flex items-center justify-center gap-2",
                  )}
                >
                  {starting && (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  )}
                  {starting ? "Opening…" : buttonLabel(q)}
                </button>
              )}
              <p
                className="text-muted-foreground text-xs leading-relaxed"
                aria-live="polite"
              >
                {priceLine(picked, interval, q, boost, mine)}
              </p>
            </div>
          )}

          <p className="text-muted-foreground text-xs leading-relaxed">
            Premier gives the place 2X ranking priority on Home and the Map,
            Premier Max 5X. Priority moves it up the list; it doesn&apos;t
            guarantee more views. Premier places show “Ad”; Premier doesn&apos;t
            verify a place. US dollars, billed by Stripe.
          </p>
        </div>
      </div>

      {failed && (
        <div className={ERROR_BOX_CLASS} role="alert">
          Couldn&apos;t load this place&apos;s Premier.{" "}
          <button
            type="button"
            onClick={onRetry}
            className="font-semibold underline"
          >
            Try again
          </button>
        </div>
      )}

      <LocalDialog
        open={leaving}
        onClose={() => (leaveBusy ? undefined : setLeaving(false))}
        ariaLabel="Leave the line"
      >
        <div className="flex flex-col gap-3 p-5 text-center">
          <span className="bg-muted text-foreground mx-auto flex h-12 w-12 items-center justify-center rounded-full">
            <XCircle className="h-5 w-5" aria-hidden />
          </span>
          <h2 className={SHEET_TITLE_CLASS}>Leave the line?</h2>
          <p className="text-muted-foreground type-body leading-relaxed">
            {mine?.role === "payer" && period
              ? `Your ${tierLabel(period.tier)} runs to ${shortDate(period.ends_at)}, then the next in line pays.`
              : "You can pledge again any time."}
          </p>
          {leaveError && <p className={ERROR_BOX_CLASS}>{leaveError}</p>}
          <div className="mt-1 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void confirmLeave()}
              disabled={leaveBusy}
              className="bg-foreground inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
            >
              {leaveBusy && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              )}
              {leaveBusy ? "Leaving…" : "Leave"}
            </button>
            <button
              type="button"
              onClick={() => setLeaving(false)}
              disabled={leaveBusy}
              className="border-border bg-card hover:bg-muted inline-flex h-11 w-full items-center justify-center rounded-full border text-sm font-semibold transition disabled:opacity-60"
            >
              Stay
            </button>
          </div>
        </div>
      </LocalDialog>
    </section>
  );
}

/** The guest's own pledge, above the line. */
function YourPledge({
  mine,
  period,
  onLeave,
}: {
  mine: MyPledge;
  period: PlaceBoost["period"];
  onLeave: () => void;
}) {
  let text: string;
  if (mine.status === "failed")
    text = "Card declined · pick a level below to pledge again";
  else if (mine.status === "open") text = "Finishing payment…";
  else if (mine.pending)
    text = `Upgrade to ${tierLabel(mine.pending)}: finishing payment…`;
  else if (mine.role === "payer" && period && mine.tier < period.tier) {
    text = `${tierLabel(period.tier)} · Paying now → ${tierLabel(mine.tier)} from ${shortDate(period.ends_at)}`;
  } else if (mine.role === "payer")
    text = `${tierLabel(mine.tier)} · Paying now`;
  else text = `${tierLabel(mine.tier)} · Backup ${mine.position}`;
  return (
    <div className="bg-muted flex min-h-12 items-center gap-3 rounded-xl px-4 py-2.5 text-sm">
      <span className="min-w-0 flex-1">
        <span className="text-muted-foreground block text-xs">Your pledge</span>
        <span className="font-semibold">{text}</span>
      </span>
      {mine.status !== "open" && (
        <button
          type="button"
          onClick={onLeave}
          className="min-h-11 px-1 text-sm font-semibold underline"
        >
          Leave
        </button>
      )}
    </div>
  );
}

/** The status line (copy table, MESITA-2995). */
function statusLine(boost: PlaceBoost | null): string {
  if (!boost) return "Not Premier yet";
  const p = boost.period;
  if (boost.renewing)
    return p ? `${tierLabel(p.tier)} · renewing…` : "Premier · renewing…";
  if (p?.granted)
    return `${tierLabel(p.tier)} · granted by Mesita until ${shortDate(p.ends_at)}`;
  if (p)
    return `${tierLabel(p.tier)} · ${p.renews ? "renews" : "ends"} ${shortDate(p.ends_at)}`;
  if (boost.line.length > 0)
    return "Not Premier · the next pledge is charged within the hour";
  return "Not Premier yet";
}

/** ONE sentence for the level the guest tapped, from the server's quote. */
function priceLine(
  tier: BoostTier,
  interval: BoostInterval,
  q: BoostQuote | null,
  boost: PlaceBoost | null,
  mine: MyPledge | null,
): string {
  if (!boost?.quotes || !q) return "Sign in to pledge.";
  const every = INTERVAL_WORD[interval];
  const mark = tierLabel({ boost_2x: 1, boost_5x: 2 }[tier]);
  const period = boost.period;
  const prefix = mine?.status === "failed" ? "Update your card. " : "";
  if (
    q.role === "payer" &&
    q.checkout === "none" &&
    mine?.role === "payer" &&
    period
  ) {
    return `Your ${tierLabel(period.tier)} runs to ${shortDate(period.ends_at)}; then ${mark} at ${money(q.price_cents)} every ${every}.`;
  }
  if (q.role === "payer") {
    if (q.charge_cents === 0) {
      return `${prefix}$0 today (covered by credit). Your ${mark} runs to ${shortDate(q.new_ends_at)}${
        q.extra_days > 0 ? `, with ${q.extra_days} extra days` : ""
      }. ${q.checkout === "none" ? "You become the payer." : "Confirm your card to become the payer."}`;
    }
    if (period?.granted) {
      return `${prefix}Pay ${money(q.charge_cents)} today. You become the payer; the granted ${tierLabel(period.tier)} ends now. Then ${money(q.price_cents)} every ${every}.`;
    }
    if (q.credit_cents > 0 && period) {
      return `${prefix}Pay ${money(q.charge_cents)} today (${money(q.price_cents)} − ${money(q.credit_cents)} left on the current ${tierLabel(period.tier)}). You become the payer. Then ${money(q.price_cents)} every ${every}.`;
    }
    return `${prefix}Pay ${money(q.charge_cents)} today, then ${money(q.price_cents)} every ${every} until you leave.`;
  }
  if (period?.granted) {
    return `${prefix}$0 today. You'd be Backup ${q.position} and pay when the grant ends ${shortDate(period.ends_at)}.`;
  }
  return `${prefix}$0 today. You'd be Backup ${q.position}. You may be charged ${money(q.price_cents)} a ${every} later, only if the pledges above you stop paying.`;
}

function buttonLabel(q: BoostQuote): string {
  if (q.checkout === "payment") return `Pay ${money(q.charge_cents)}`;
  if (q.checkout === "setup")
    return q.role === "payer" ? "Confirm card" : "Pledge as backup";
  return "Save change";
}

/** The Premier tab on a Google-only card (MESITA-2797): no Mesita row, so
 *  nothing to pledge for yet. */
export function BoostUnavailable() {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="bg-muted text-foreground flex h-14 w-14 items-center justify-center rounded-2xl">
        <BadgeCheck className="h-7 w-7" aria-hidden />
      </span>
      <h3 className={cn(SHEET_TITLE_CLASS, "mt-4")}>
        Premier isn&apos;t open here yet
      </h3>
      <p className="text-muted-foreground mt-1.5 max-w-[30ch] text-sm leading-relaxed">
        You can make this place Premier once it has its Mesita profile.
      </p>
    </div>
  );
}
