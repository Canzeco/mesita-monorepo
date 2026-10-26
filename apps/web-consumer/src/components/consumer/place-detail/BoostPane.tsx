"use client";

import { Fragment, useState } from "react";
import { Loader2, XCircle, Zap } from "lucide-react";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { RowDivider, SettingsGroup, Switch } from "@/components/consumer/me/settings-rows";
import {
  apiCancelBoost,
  apiStartBoost,
  BOOST_TIER_LABEL,
  BOOST_TIERS,
  boostPrice,
  type MyBacking,
  type PlaceBoost,
  type BoostInterval,
  type BoostTier,
} from "@/lib/api/boost";
import type { PlaceDetail } from "@/lib/place-detail";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { ERROR_BOX_CLASS, PRIMARY_BUTTON_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

// THE BOOST TAB (MESITA-2789, Spotlight's sheet before it, MESITA-1998:
// "cualquiera se suscriba ... desde la Consumer App"). Anyone pays for a
// place's paid visibility with their own subscription: Boost 2x · 5x · 10x,
// monthly or yearly (ten months for twelve), whether to be named, then
// Stripe Checkout. Many guests can back one place, so one lapsed card never
// takes the tier from the rest. Paid, never verified, never Selected: the
// copy says so, and the place shows Sponsored while it holds a tier.
// Nothing here claims a charge: success is said only after
// consumer-web-get-boost confirms the Checkout session (member-place-actions).

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
  const [tier, setTier] = useState<BoostTier>("boost_2x");
  const [interval, setBillingInterval] = useState<BoostInterval>("month");
  const [showName, setShowName] = useState(true);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState<MyBacking | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const current = boost ? BOOST_TIER_LABEL[boost.tier] : null;
  const mine = (boost?.mine ?? []).filter((b) => b.live);

  async function start() {
    if (starting) return;
    setStarting(true);
    try {
      const url = await apiStartBoost(getSupabase(), {
        placeId: place.id,
        tier,
        interval,
        showName,
        returnUrl: `${window.location.origin}${window.location.pathname}`,
      });
      window.location.assign(url);
    } catch (err) {
      toast.error(errMsg(err, "Couldn't open checkout. Try again."));
      setStarting(false);
    }
  }

  async function confirmCancel() {
    if (!cancelling || cancelBusy) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      await apiCancelBoost(getSupabase(), cancelling.id);
      setCancelling(null);
      toast("Your Boost ends at the close of this period");
      onChanged();
    } catch (err) {
      setCancelError(errMsg(err, "Couldn't cancel. Try again."));
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 py-2" aria-labelledby="boost-title">
      <div className="flex items-center gap-3">
        <span className="bg-muted text-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
          <Zap className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="boost-title" className={SHEET_TITLE_CLASS}>
            Boost {place.name}
          </h2>
          <p className="text-muted-foreground text-xs" aria-live="polite">
            {loading
              ? "Loading…"
              : current && boost
                ? `${current} now · backed by ${backedBy(boost)}`
                : "Not boosted yet"}
          </p>
        </div>
      </div>

      <p className="text-muted-foreground text-sm leading-relaxed">
        Boost puts this place in front of more guests on the Map and Home. It is
        paid visibility, shown to guests as <span className="text-foreground font-semibold">Sponsored</span>.
        It is not a Mesita Selected recommendation and does not verify the place.
        Anyone can boost any place, and backers add up.
      </p>

      {failed && (
        <div className={ERROR_BOX_CLASS} role="alert">
          Couldn&apos;t load this place&apos;s Boost.{" "}
          <button type="button" onClick={onRetry} className="font-semibold underline">
            Try again
          </button>
        </div>
      )}

      {mine.length > 0 && (
        <div>
          <p className="text-sm font-semibold">Your Boost</p>
          <div className="mt-2">
            <SettingsGroup>
              {mine.map((b, i) => (
                <Fragment key={b.id}>
                  {i > 0 && <RowDivider />}
                  <div className="flex min-h-12 items-center gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">
                        {BOOST_TIERS.find((t) => t.key === b.tier)?.label ?? "Boost"}
                      </span>
                      <span className="text-muted-foreground"> · {b.interval === "year" ? "Yearly" : "Monthly"}</span>
                      <span className="text-muted-foreground block text-xs">
                        {b.cancel_at_period_end ? "Ends" : "Renews"} {formatDate(b.current_period_end)}
                      </span>
                    </span>
                    {!b.cancel_at_period_end && (
                      <button
                        type="button"
                        onClick={() => {
                          setCancelError(null);
                          setCancelling(b);
                        }}
                        className="text-destructive text-sm font-semibold"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </Fragment>
              ))}
            </SettingsGroup>
          </div>
        </div>
      )}

      <div>
        <div className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1" role="radiogroup" aria-label="Billing">
          {(["month", "year"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={interval === v}
              onClick={() => setBillingInterval(v)}
              className={cn(
                "rounded-md py-2 text-sm font-semibold transition",
                interval === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {v === "month" ? "Monthly" : "Yearly · 2 months free"}
            </button>
          ))}
        </div>

        <div className="mt-3" role="radiogroup" aria-label="Boost level">
          <SettingsGroup>
            {BOOST_TIERS.map((t, i) => {
              const picked = tier === t.key;
              return (
                <Fragment key={t.key}>
                  {i > 0 && <RowDivider />}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={picked}
                    onClick={() => setTier(t.key)}
                    className="hover:bg-muted flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left text-sm transition"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{t.label}</span>
                      <span className="text-muted-foreground block text-xs">{t.blurb}</span>
                    </span>
                    <span className="font-semibold whitespace-nowrap">{boostPrice(t.monthly, interval)}</span>
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                        picked ? "border-foreground" : "border-border",
                      )}
                    >
                      {picked ? <span className="bg-foreground h-2.5 w-2.5 rounded-full" /> : null}
                    </span>
                  </button>
                </Fragment>
              );
            })}
          </SettingsGroup>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={showName}
        onClick={() => setShowName((v) => !v)}
        className="flex w-full items-center gap-3 px-1 py-1 text-left text-sm"
      >
        <span className="min-w-0 flex-1">Show my first name as a backer</span>
        <Switch on={showName} />
      </button>

      <button
        type="button"
        onClick={() => void start()}
        disabled={starting}
        className={cn(PRIMARY_BUTTON_CLASS, "inline-flex items-center justify-center gap-2")}
      >
        {starting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {starting ? "Opening checkout…" : `Continue · ${boostPrice(BOOST_TIERS.find((t) => t.key === tier)!.monthly, interval)}`}
      </button>
      <p className="text-muted-foreground text-center text-xs">
        Prices in US dollars. Billed by Stripe. Cancel any time here; your Boost
        runs to the end of the period you paid for.
      </p>

      <LocalDialog
        open={cancelling != null}
        onClose={() => (cancelBusy ? undefined : setCancelling(null))}
        ariaLabel="Cancel this Boost"
      >
        <div className="flex flex-col gap-3 p-5 text-center">
          <span className="bg-muted text-foreground mx-auto flex h-12 w-12 items-center justify-center rounded-full">
            <XCircle className="h-5 w-5" aria-hidden />
          </span>
          <h2 className={SHEET_TITLE_CLASS}>Cancel this Boost?</h2>
          <p className="text-muted-foreground type-body leading-relaxed">
            It stops renewing and stays on until {formatDate(cancelling?.current_period_end ?? null)}.
          </p>
          {cancelError && <p className={ERROR_BOX_CLASS}>{cancelError}</p>}
          <div className="mt-1 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void confirmCancel()}
              disabled={cancelBusy}
              className="bg-foreground inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
            >
              {cancelBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {cancelBusy ? "Cancelling…" : "Yes, cancel it"}
            </button>
            <button
              type="button"
              onClick={() => setCancelling(null)}
              disabled={cancelBusy}
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

/** "Ana, Luis and 2 others" — names first, then the unnamed backers. */
export function backedBy(s: Pick<PlaceBoost, "backers" | "names">): string {
  const named = s.names.slice(0, 2);
  const others = Math.max(0, s.backers - named.length);
  if (named.length === 0) return s.backers === 1 ? "1 guest" : `${s.backers} guests`;
  const tail = others > 0 ? ` and ${others} ${others === 1 ? "other" : "others"}` : "";
  return named.length === 2 && others === 0 ? `${named[0]} and ${named[1]}` : `${named.join(", ")}${tail}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "soon";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
