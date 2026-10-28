"use client";

import { Fragment, useState } from "react";
import { BadgeCheck, Loader2, XCircle } from "lucide-react";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { RowDivider, SettingsGroup } from "@/components/consumer/me/settings-rows";
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
import { MAP_OFFICIAL_PIN_COLOR } from "@/lib/map-defaults";
import type { PlaceDetail } from "@/lib/place-detail";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import {
  ERROR_BOX_CLASS,
  PRIMARY_BUTTON_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

// THE OFFICIAL TAB (MESITA-2925, was Boost; MESITA-2861: the place's fourth
// tab; a sheet off ⋯ in MESITA-2815, a tab in MESITA-2789, Spotlight's
// sheet before it, MESITA-1998: "cualquiera se suscriba ... desde la
// Consumer App"). Anyone makes a place Official with their own
// subscription: Official 2X · 5X · 10X, monthly or yearly (ten months for
// twelve), then Stripe Checkout. Backers are anonymous (MESITA-2928): no
// name is asked for, sent or shown, only how many guests back it. Many guests can back
// one place, so one lapsed card never takes the tier from the rest. The
// place wears "Official 2X" after its name and a red pin while it holds a
// tier; the copy says it is paid visibility.
// Nothing here claims a charge: success is said only after
// consumer-web-get-boost confirms the Checkout session (member-place-actions).

/** The tile's big mark: the level alone. */
const TIER_MULTIPLIER: Record<BoostTier, string> = {
  boost_2x: "2X",
  boost_5x: "5X",
  boost_10x: "10X",
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
  const [tier, setTier] = useState<BoostTier>("boost_2x");
  const [interval, setBillingInterval] = useState<BoostInterval>("month");
  // The choices replace the card in the same pane (MESITA-2817), so a
  // second sheet never stacks.
  const [choosing, setChoosing] = useState(false);
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
      toast("Your backing ends at the close of this period");
      onChanged();
    } catch (err) {
      setCancelError(errMsg(err, "Couldn't cancel. Try again."));
    } finally {
      setCancelBusy(false);
    }
  }

  function openSheet(pick: BoostTier) {
    setTier(pick);
    setChoosing(true);
  }

  const picked = BOOST_TIERS.find((t) => t.key === tier)!;

  return (
    <section className="flex flex-col gap-4 py-2" aria-labelledby="boost-title">
      {choosing ? (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => (starting ? undefined : setChoosing(false))}
            className="text-muted-foreground -mb-2 self-start text-sm font-semibold"
          >
            ‹ Back
          </button>
          <div className="flex items-center gap-3">
            <span className="bg-muted text-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
              <BadgeCheck className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 id="boost-title" className={SHEET_TITLE_CLASS}>Make it Official</h2>
              <p className="text-muted-foreground truncate text-xs">{place.name}</p>
            </div>
          </div>

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

          <div role="radiogroup" aria-label="Official level">
            <SettingsGroup>
              {BOOST_TIERS.map((t, i) => {
                const on = tier === t.key;
                return (
                  <Fragment key={t.key}>
                    {i > 0 && <RowDivider />}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
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
                          on ? "border-foreground" : "border-border",
                        )}
                      >
                        {on ? <span className="bg-foreground h-2.5 w-2.5 rounded-full" /> : null}
                      </span>
                    </button>
                  </Fragment>
                );
              })}
            </SettingsGroup>
          </div>

          <button
            type="button"
            onClick={() => void start()}
            disabled={starting}
            className={cn(PRIMARY_BUTTON_CLASS, "inline-flex items-center justify-center gap-2")}
          >
            {starting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {starting ? "Opening checkout…" : `Continue · ${boostPrice(picked.monthly, interval)}`}
          </button>
          <p className="text-muted-foreground text-center text-xs">
            Prices in US dollars. Billed by Stripe. Official is paid visibility:
            it does not verify the place. Cancel any time; your backing runs to
            the end of the period you paid for.
          </p>
        </div>
      ) : (
        <>
      {/* A SHORT CARD, THEN THE CHOICES (Pato, MESITA-2814: "maybe create a
          modal … if i click the modal, then open something"). The card says
          where the place stands, what Official is in one line, and the three
          levels as tiles; a tile or the button swaps in billing and
          Checkout in the same pane (MESITA-2815, MESITA-2817). */}
      <div className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
              current ? "text-white" : "bg-muted text-foreground",
            )}
            style={current ? { backgroundColor: MAP_OFFICIAL_PIN_COLOR } : undefined}
          >
            <BadgeCheck className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="boost-title" className="text-base leading-tight font-semibold">
              {current ?? "Not Official yet"}
            </h2>
            <p className="text-muted-foreground truncate text-xs" aria-live="polite">
              {loading
                ? "Loading…"
                : current && boost
                  ? `Backed by ${backedBy(boost.backers)}`
                  : "Be the first to back it"}
            </p>
          </div>
        </div>

        <p className="text-muted-foreground text-sm leading-relaxed">
          Show {place.name} to more guests on the Map and Home. Guests see{" "}
          <span className="text-foreground font-semibold">Official</span> and
          its level beside its name, and a red pin on the Map.
        </p>

        <div className="grid grid-cols-3 gap-2">
          {BOOST_TIERS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => openSheet(t.key)}
              className="border-border hover:bg-muted flex flex-col items-center gap-0.5 rounded-xl border px-2 py-3 transition active:scale-[0.98]"
            >
              <span className="font-display text-2xl leading-none font-semibold">
                {TIER_MULTIPLIER[t.key]}
              </span>
              <span className="text-muted-foreground text-xs">
                {boostPrice(t.monthly, "month")}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => openSheet(tier)}
          className={cn(PRIMARY_BUTTON_CLASS, "inline-flex items-center justify-center gap-2")}
        >
          <BadgeCheck className="h-4 w-4" aria-hidden />
          {current ? "Back it too" : "Make it Official"}
        </button>
      </div>

      {failed && (
        <div className={ERROR_BOX_CLASS} role="alert">
          Couldn&apos;t load this place&apos;s Official level.{" "}
          <button type="button" onClick={onRetry} className="font-semibold underline">
            Try again
          </button>
        </div>
      )}

      {mine.length > 0 && (
        <div>
          <p className="text-sm font-semibold">Your backing</p>
          <div className="mt-2">
            <SettingsGroup>
              {mine.map((b, i) => (
                <Fragment key={b.id}>
                  {i > 0 && <RowDivider />}
                  <div className="flex min-h-12 items-center gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">
                        {BOOST_TIERS.find((t) => t.key === b.tier)?.label ?? "Official"}
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


        </>
      )}

      <LocalDialog
        open={cancelling != null}
        onClose={() => (cancelBusy ? undefined : setCancelling(null))}
        ariaLabel="Cancel your backing"
      >
        <div className="flex flex-col gap-3 p-5 text-center">
          <span className="bg-muted text-foreground mx-auto flex h-12 w-12 items-center justify-center rounded-full">
            <XCircle className="h-5 w-5" aria-hidden />
          </span>
          <h2 className={SHEET_TITLE_CLASS}>Cancel your backing?</h2>
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

/** The Official tab on a Google-only card (MESITA-2797): no Mesita row, so
 *  nothing to back yet. */
export function BoostUnavailable() {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="bg-muted text-foreground flex h-14 w-14 items-center justify-center rounded-2xl">
        <BadgeCheck className="h-7 w-7" aria-hidden />
      </span>
      <h3 className={cn(SHEET_TITLE_CLASS, "mt-4")}>Official isn&apos;t open here yet</h3>
      <p className="text-muted-foreground mt-1.5 max-w-[30ch] text-sm leading-relaxed">
        You can make this place Official once it has its Mesita profile.
      </p>
    </div>
  );
}

/** "1 guest" · "3 guests": a count, never a name (MESITA-2928). */
export function backedBy(backers: number): string {
  return backers === 1 ? "1 guest" : `${backers} guests`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "soon";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
