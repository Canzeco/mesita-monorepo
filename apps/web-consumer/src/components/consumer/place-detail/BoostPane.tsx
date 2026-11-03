"use client";

import { useState } from "react";
import {
  BadgeCheck,
  ChevronRight,
  Loader2,
  Rocket,
  Store,
  X,
  XCircle,
} from "lucide-react";
import {
  LocalDialog,
  LocalSheet,
} from "@/components/consumer/overlay/LocalOverlay";
import { EFError } from "@/lib/api/_invoke";
import {
  apiCancelBoost,
  apiDismissPremierNotice,
  apiStartBoost,
  tierLabel,
  BOOST_TIERS,
  money,
  shortDate,
  START_REFUSED,
  type BoostInterval,
  type BoostQuote,
  type BoostTier,
  type EndedNotice,
  type PlaceBoost,
} from "@/lib/api/boost";
import { businessClaimHref } from "@/lib/business-url";
import { PremierCodeBox } from "@/components/consumer/place-detail/PremierCodeBox";
import { MAP_PREMIER_PIN_COLOR } from "@/lib/map-defaults";
import type { PlaceDetail } from "@/lib/place-detail";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import {
  ERROR_BOX_CLASS,
  PRIMARY_BUTTON_CLASS,
  SHEET_BODY_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

// THE PREMIER TAB (MESITA-3092; Premier MESITA-2925, the place's fourth tab
// MESITA-2861). Pato, 2026-10-29: one Paid subscription per place — anyone
// buys it when none runs, the guest who pays manages it, a declined renewal
// ends it. Mesita's Manual Premier (MESITA-3091) is apart, and levels it
// already gives are not for sale.
//
// Three boxes (MESITA-3107, Pato 2026-11-02): the place's Premier level on a
// 0–3 meter; the subscription, one row that opens a sheet with the perks,
// the prices and every action; and "Is this your business?", the Business
// app's claim page. The database allows levels 0–2 (MESITA-3041): level 3
// reads "Soon" and nothing sells it. The status grammar is `Premier <level> · <by Mesita | paid | paid by you> ·
// <renews | ends> <date>`; when both layers run, the higher level leads.
// Every amount and date is the server's (consumer-web-get-premier); nothing
// here computes money. Premier is paid ranking priority: it never verifies
// the place and never promises views.

const INTERVAL_WORD: Record<BoostInterval, string> = {
  month: "month",
  year: "year",
};

const RANK_OF: Record<BoostTier, number> = { boost_2x: 1, boost_5x: 2 };

/** The level meter's three steps above 0: the two plans, then "Soon". */
const LEVELS: ReadonlyArray<{ rank: number; label: string; soon?: boolean }> = [
  ...BOOST_TIERS.map((t) => ({
    rank: t.rank,
    label: `${t.label} · ${t.priority}`,
  })),
  { rank: 3, label: "Soon", soon: true },
];

/** What the plan buys, said in the sheet above the prices. */
const PERKS = [
  "Moves the place up on Home and the Map: 2X priority with Premier, 5X with Premier Max.",
  "A red Premier pin on the Map.",
  "Pay monthly, or yearly and get two months free. Stop renewing any time.",
];

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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [interval, setBillingInterval] = useState<BoostInterval>(
    boost?.mine?.interval ?? "month",
  );
  const [picked, setPicked] = useState<BoostTier | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [stopBusy, setStopBusy] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);

  const viewer = boost?.viewer ?? null;
  const paid = boost?.paid ?? null;
  const manual = boost?.manual ?? null;
  const mine = boost?.mine ?? null;
  const live = (boost?.tier ?? 0) > 0;
  const payer = viewer === "payer" && mine?.status === "ready";
  // Someone else holds the place's subscription: nothing to buy here.
  const taken = Object.values(boost?.quotes ?? {}).some(
    (byInterval) => byInterval[interval].blocked_by === "taken",
  );
  // What this guest may pick: never a level Mesita already gives, never
  // anything while someone else pays.
  const forSale = BOOST_TIERS.filter((t) => {
    const tq = boost?.quotes?.[t.key][interval];
    return tq ? tq.kind !== "blocked" : !manual || manual.tier < t.rank;
  });
  // The payer and the former payer see the plans only once they ask.
  const owns = payer || viewer === "former_payer";
  const showPlans =
    !loading && !boost?.renewing && !taken && (!owns || choosing);
  const q = picked && boost?.quotes ? boost.quotes[picked][interval] : null;
  const status = statusLines(boost);
  const notice = boost ? noticeLine(boost) : null;
  const level = boost?.tier ?? 0;
  const claimHref = businessClaimHref(place.id);
  const returnUrl = () =>
    `${window.location.origin}${window.location.pathname}`;

  async function start() {
    if (!picked || starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const res = await apiStartBoost(getSupabase(), {
        placeId: place.id,
        tier: picked,
        interval,
        returnUrl: returnUrl(),
      });
      if (res.url) {
        window.location.assign(res.url);
        return;
      }
      toast(
        res.outcome === "confirmed"
          ? `${tierLabel(RANK_OF[picked])} is on`
          : "Your plan changes at the next renewal",
      );
      setPicked(null);
      setChoosing(false);
      setStarting(false);
      setSheetOpen(false);
      onChanged();
    } catch (err) {
      setStartError(refusal(err, "Couldn't open checkout. Try again."));
      setStarting(false);
    }
  }

  async function updateCard() {
    if (starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const res = await apiStartBoost(getSupabase(), {
        placeId: place.id,
        updateCard: true,
        returnUrl: returnUrl(),
      });
      if (res.url) window.location.assign(res.url);
      else setStarting(false);
    } catch (err) {
      setStartError(refusal(err, "Couldn't open checkout. Try again."));
      setStarting(false);
    }
  }

  async function confirmStop() {
    if (stopBusy) return;
    setStopBusy(true);
    setStopError(null);
    try {
      await apiCancelBoost(getSupabase(), place.id);
      setStopping(false);
      setSheetOpen(false);
      toast(
        paid
          ? `Premier won't renew. It runs until ${shortDate(paid.ends_at)}.`
          : "Premier won't renew.",
      );
      onChanged();
    } catch (err) {
      setStopError(errMsg(err, "Couldn't stop renewing. Try again."));
    } finally {
      setStopBusy(false);
    }
  }

  async function dismissNotice() {
    try {
      await apiDismissPremierNotice(getSupabase(), place.id);
      onChanged();
    } catch (err) {
      toast(errMsg(err, "Couldn't hide that. Try again."));
    }
  }

  return (
    <section className="flex flex-col gap-4 py-2" aria-labelledby="boost-title">
      <h2 id="boost-title" className="sr-only">
        Premier
      </h2>

      {/* Box 1: the level, 0–3. */}
      <div
        className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4"
        aria-live="polite"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="type-eyebrow text-muted-foreground">Premier level</h3>
          <span className="text-sm font-semibold">
            {loading ? "…" : level}
            <span className="text-muted-foreground font-normal"> / 3</span>
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5" aria-hidden>
          {LEVELS.map((l) => (
            <div key={l.rank} className="flex flex-col gap-1">
              <span
                className={cn(
                  "h-2 rounded-full",
                  !loading && level >= l.rank
                    ? ""
                    : l.soon
                      ? "border-border border border-dashed"
                      : "bg-muted",
                )}
                style={
                  !loading && level >= l.rank
                    ? { backgroundColor: MAP_PREMIER_PIN_COLOR }
                    : undefined
                }
              />
              <span className="text-muted-foreground type-label">
                {l.label}
              </span>
            </div>
          ))}
        </div>
        <p className="text-sm">
          <span className="block font-semibold">
            {loading ? "Loading…" : status.head}
          </span>
          {!loading && (status.sub || !live) && (
            <span className="text-muted-foreground block text-xs">
              {status.sub ?? "Premier moves a place up on Home and the Map."}
            </span>
          )}
        </p>
      </div>

      {/* Box 2: the subscription; the sheet holds the prices and actions. */}
      <div className="border-border bg-card flex flex-col rounded-2xl border">
        {notice && (
          <div
            className="border-border bg-muted flex items-start gap-3 rounded-t-2xl border-b px-4 py-3 text-sm"
            aria-live="polite"
          >
            <span className="min-w-0 flex-1 leading-relaxed">
              {notice.text}
            </span>
            {notice.dismissible && (
              <button
                type="button"
                onClick={() => void dismissNotice()}
                aria-label="Hide this notice"
                className="text-muted-foreground -m-2 flex h-11 w-11 shrink-0 items-center justify-center"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          disabled={loading}
          className="flex min-h-16 items-center gap-3 px-4 py-3 text-left transition active:scale-[0.99] disabled:opacity-60"
        >
          <span className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <Rocket className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">
              Premier subscription
            </span>
            <span className="text-muted-foreground block text-xs">
              {subscriptionLine(boost, forSale.length > 0)}
            </span>
          </span>
          <ChevronRight
            className="text-muted-foreground h-5 w-5 shrink-0"
            aria-hidden
          />
        </button>
      </div>

      {/* Mesita codes (MESITA-3167): free Refill days for this place. */}
      <PremierCodeBox placeId={place.id} onRedeemed={onChanged} />

      {/* Box 3: the Business app's claim page, in a new tab. */}
      {claimHref && (
        <a
          href={claimHref}
          target="_blank"
          rel="noopener"
          className="border-border bg-card flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3 transition active:scale-[0.99]"
        >
          <span className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <Store className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">
              Is this your business?
            </span>
            <span className="text-muted-foreground block text-xs">
              Claim it on Mesita Business to manage its page.
            </span>
          </span>
          <ChevronRight
            className="text-muted-foreground h-5 w-5 shrink-0"
            aria-hidden
          />
        </a>
      )}

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

      <LocalSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        ariaLabel="Premier subscription"
      >
        <div className={SHEET_BODY_CLASS}>
          <h2 className={SHEET_TITLE_CLASS}>Mesita Premier</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            A monthly or yearly plan that moves {place.name} up for every guest.
          </p>
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-2">
                <BadgeCheck
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: MAP_PREMIER_PIN_COLOR }}
                  aria-hidden
                />
                <span className="leading-relaxed">{perk}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-4">
            {/* Actions. */}
            {!loading && boost?.renewing && (
              <p className="text-muted-foreground text-sm">
                Renewing… this takes a minute.
              </p>
            )}

            {!loading && !boost?.renewing && payer && !choosing && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setChoosing(true);
                    setStartError(null);
                  }}
                  className={PRIMARY_BUTTON_CLASS}
                >
                  Change plan
                </button>
                {startError && <p className={ERROR_BOX_CLASS}>{startError}</p>}
                <div className="flex justify-center gap-6">
                  <button
                    type="button"
                    onClick={() => void updateCard()}
                    disabled={starting}
                    className="min-h-11 text-sm font-semibold underline disabled:opacity-60"
                  >
                    {starting ? "Opening…" : "Update card"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStopping(true)}
                    className="min-h-11 text-sm font-semibold underline"
                  >
                    Stop renewing
                  </button>
                </div>
              </div>
            )}

            {!loading &&
              !boost?.renewing &&
              viewer === "former_payer" &&
              !choosing && (
                <div className="flex flex-col gap-2">
                  {boost?.can_resume ? (
                    <button
                      type="button"
                      onClick={() => {
                        setChoosing(true);
                        setStartError(null);
                        const current = BOOST_TIERS.find(
                          (t) => t.rank === paid?.tier,
                        );
                        if (current) setPicked(current.key);
                      }}
                      className={PRIMARY_BUTTON_CLASS}
                    >
                      Resume
                    </button>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      This subscription can&apos;t be resumed.
                    </p>
                  )}
                </div>
              )}

            {!loading && !boost?.renewing && taken && !owns && (
              <p className="text-muted-foreground text-sm leading-relaxed">
                Someone else pays for Premier here, so it can&apos;t be bought
                again until it ends.
              </p>
            )}

            {showPlans && forSale.length === 0 && manual && (
              <p className="text-muted-foreground text-sm leading-relaxed">
                Mesita gives this place {tierLabel(manual.tier)} until{" "}
                {shortDate(manual.ends_at)}, the highest level. Nothing to buy.
              </p>
            )}

            {showPlans && forSale.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="type-eyebrow text-muted-foreground">
                    {payer
                      ? "Change your plan"
                      : viewer === "former_payer"
                        ? "Resume Premier"
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
                  {forSale.map((t) => {
                    const tq = boost?.quotes?.[t.key][interval];
                    const on = picked === t.key;
                    const current =
                      payer &&
                      mine?.tier === t.rank &&
                      mine.interval === interval;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={current}
                        onClick={() => {
                          setPicked(t.key);
                          setStartError(null);
                        }}
                        className={cn(
                          "flex min-h-16 items-center gap-3 rounded-xl border px-4 py-3 text-left transition active:scale-[0.99] disabled:opacity-60",
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
                            {current && (
                              <span className="text-muted-foreground text-xs font-normal">
                                {" "}
                                · your plan
                              </span>
                            )}
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

                {!boost?.quotes && (
                  <p className="text-muted-foreground text-xs">
                    Sign in to make this place Premier.
                  </p>
                )}

                {picked && q && boost && (
                  <div className="flex flex-col gap-2">
                    {startError && (
                      <p className={ERROR_BOX_CLASS}>{startError}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => void start()}
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
                    <p
                      className="text-muted-foreground text-xs leading-relaxed"
                      aria-live="polite"
                    >
                      {priceLine(picked, interval, q, boost)}
                    </p>
                  </div>
                )}

                {owns && (
                  <button
                    type="button"
                    onClick={() => {
                      setChoosing(false);
                      setPicked(null);
                      setStartError(null);
                    }}
                    className="min-h-11 text-sm font-semibold underline"
                  >
                    Cancel
                  </button>
                )}

                <p className="text-muted-foreground text-xs leading-relaxed">
                  Premier gives the place 2X ranking priority on Home and the
                  Map, Premier Max 5X. Priority moves it up the list; it
                  doesn&apos;t guarantee more views. Premier places show “Ad”;
                  Premier doesn&apos;t verify a place. One subscription per
                  place, billed by Stripe in US dollars; a declined renewal ends
                  it.
                </p>
              </div>
            )}
          </div>
        </div>
      </LocalSheet>

      <LocalDialog
        open={stopping}
        onClose={() => (stopBusy ? undefined : setStopping(false))}
        ariaLabel="Stop renewing"
      >
        <div className="flex flex-col gap-3 p-5 text-center">
          <span className="bg-muted text-foreground mx-auto flex h-12 w-12 items-center justify-center rounded-full">
            <XCircle className="h-5 w-5" aria-hidden />
          </span>
          <h2 className={SHEET_TITLE_CLASS}>Stop renewing?</h2>
          <p className="text-muted-foreground type-body leading-relaxed">
            {paid
              ? `${tierLabel(paid.tier)} runs until ${shortDate(paid.ends_at)}. Nothing more is charged and your card is removed.`
              : "Nothing more is charged and your card is removed."}
          </p>
          {stopError && <p className={ERROR_BOX_CLASS}>{stopError}</p>}
          <div className="mt-1 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void confirmStop()}
              disabled={stopBusy}
              className="bg-foreground inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
            >
              {stopBusy && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              )}
              {stopBusy ? "Stopping…" : "Stop renewing"}
            </button>
            <button
              type="button"
              onClick={() => setStopping(false)}
              disabled={stopBusy}
              className="border-border bg-card hover:bg-muted inline-flex h-11 w-full items-center justify-center rounded-full border text-sm font-semibold transition disabled:opacity-60"
            >
              Keep it
            </button>
          </div>
        </div>
      </LocalDialog>
    </section>
  );
}

/** A refused start in one line, from the server's code. */
function refusal(err: unknown, fallback: string): string {
  if (err instanceof EFError && err.code && START_REFUSED[err.code])
    return START_REFUSED[err.code];
  return errMsg(err, fallback);
}

const ENDED_TEXT: Record<EndedNotice["reason"], (n: EndedNotice) => string> = {
  declined: (n) => `Premier ended ${shortDate(n.at)}: your card was declined.`,
  stopped_by_place: (n) =>
    `The place stopped renewing; Premier runs until ${shortDate(n.runs_until)}.`,
  taken_over: (n) =>
    n.runs_until
      ? `The place took over this subscription; your paid days run until ${shortDate(n.runs_until)}.`
      : "The place took over this subscription; Premier continues.",
  covered: (n) =>
    `Your Premier ended ${shortDate(n.at)}: Mesita covered this place for longer than your plan, so your card was not charged.`,
};

/** The notice row: the guest's ended subscription, or Mesita covering the
 *  level they pay for (their plan renews after). */
function noticeLine(
  boost: PlaceBoost,
): { text: string; dismissible: boolean } | null {
  const n = boost.ended_notice;
  if (n) return { text: ENDED_TEXT[n.reason](n), dismissible: true };
  const m = boost.manual;
  const mine = boost.mine;
  if (
    boost.viewer === "payer" &&
    mine?.status === "ready" &&
    m &&
    m.tier >= mine.tier
  ) {
    return {
      text: `Mesita covers this place at ${tierLabel(m.tier)} until ${shortDate(m.ends_at)}; your ${tierLabel(mine.tier)} renews after that.`,
      dismissible: false,
    };
  }
  return null;
}

/** The status (the higher level leads, the other layer below it). */
function statusLines(boost: PlaceBoost | null): {
  head: string;
  sub: string | null;
} {
  if (!boost) return { head: "Not Premier", sub: null };
  const p = boost.paid;
  if (boost.renewing)
    return {
      head: p ? `${tierLabel(p.tier)} · renewing…` : "Premier · renewing…",
      sub: null,
    };
  const m = boost.manual;
  const paid = p
    ? `${tierLabel(p.tier)} · ${p.by_you ? "paid by you" : "paid"} · ${p.renews ? "renews" : "ends"} ${shortDate(p.ends_at)}`
    : null;
  const byMesita = m
    ? `${tierLabel(m.tier)} · by Mesita · ends ${shortDate(m.ends_at)}`
    : null;
  if (paid && byMesita)
    return m!.tier >= p!.tier
      ? { head: byMesita, sub: paid }
      : { head: paid, sub: byMesita };
  if (paid || byMesita) return { head: (paid ?? byMesita)!, sub: null };
  if (boost.viewer === "payer" && boost.mine?.status === "ready")
    return {
      head: "Not Premier",
      sub: "Your plan is charged within a few minutes.",
    };
  return { head: "Not Premier", sub: null };
}

/** The subscription box's one line: the guest's own plan, who else holds
 *  it, or the lowest monthly price the server quotes. */
function subscriptionLine(
  boost: PlaceBoost | null,
  anyForSale: boolean,
): string {
  if (!boost) return "Plans and prices";
  if (boost.renewing) return "Renewing… this takes a minute.";
  const p = boost.paid;
  if (p?.by_you)
    return `You pay for ${tierLabel(p.tier)} · ${p.renews ? "renews" : "ends"} ${shortDate(p.ends_at)}`;
  if (boost.viewer === "former_payer") return "Your plan stopped · see options";
  if (p) return "Someone else pays for Premier here";
  if (!anyForSale && boost.manual) return "Mesita already gives the top level";
  const monthly = BOOST_TIERS.map(
    (t) => boost.quotes?.[t.key].month.price_cents,
  ).filter((c): c is number => typeof c === "number");
  return monthly.length > 0
    ? `From ${money(Math.min(...monthly))}/mo · 2X or 5X priority`
    : "2X or 5X priority on Home and the Map";
}

/** ONE sentence for the plan the guest tapped, from the server's quote. */
function priceLine(
  tier: BoostTier,
  interval: BoostInterval,
  q: BoostQuote,
  boost: PlaceBoost,
): string {
  const every = INTERVAL_WORD[interval];
  const mark = tierLabel(RANK_OF[tier]);
  const p = boost.paid;
  if (q.kind === "resume")
    return `Nothing today. ${mark} renews ${shortDate(q.renews_at)} at ${money(q.price_cents)} every ${every}.`;
  if (q.kind === "change" && q.checkout === "none" && q.renews_at && p)
    return `Your ${tierLabel(p.tier)} runs to ${shortDate(p.ends_at)}; then ${mark} at ${money(q.price_cents)} every ${every}.`;
  if (q.charge_cents === 0)
    return `$0 today (covered by what's left on your plan). ${mark} runs to ${shortDate(q.new_ends_at)}${
      q.extra_days > 0 ? `, with ${q.extra_days} extra days` : ""
    }, then ${money(q.price_cents)} every ${every}.`;
  if (q.credit_cents > 0)
    return `Pay ${money(q.charge_cents)} today (${money(q.price_cents)} − ${money(q.credit_cents)} left on your plan). Then ${money(q.price_cents)} every ${every}.`;
  return `Pay ${money(q.charge_cents)} today, then ${money(q.price_cents)} every ${every} until you stop.`;
}

function buttonLabel(q: BoostQuote): string {
  if (q.kind === "resume") return "Resume";
  if (q.checkout === "payment") return `Pay ${money(q.charge_cents)}`;
  if (q.checkout === "setup") return "Confirm card";
  return q.renews_at ? "Save change" : "Upgrade now";
}

/** The Premier tab on a Google-only card (MESITA-2797): no Mesita row, so
 *  nothing to buy yet. */
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
