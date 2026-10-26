"use client";

import { Fragment, useState } from "react";
import { Sparkles } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { RowDivider, SettingsGroup, Switch } from "@/components/consumer/me/settings-rows";
import {
  apiCancelSpotlight,
  apiStartSpotlight,
  SPOTLIGHT_TIER_LABEL,
  SPOTLIGHT_TIERS,
  spotlightPrice,
  type PlaceSpotlight,
  type SpotlightInterval,
  type SpotlightTier,
} from "@/lib/api/spotlight";
import type { PlaceDetail } from "@/lib/place-detail";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { PRIMARY_BUTTON_CLASS, SHEET_BODY_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

// SPOTLIGHT, FROM THE THREE DOTS (Pato, MESITA-1998: "cualquiera se
// suscriba ... desde la Consumer App"). Anyone backs a place's paid tier
// with their own subscription: pick Spotlight or Spotlight Plus, monthly or
// yearly, whether to be named, then Stripe Checkout. Many guests can back
// one place, so one lapsed card never takes the tier from the rest.
// Paid, never verified: the copy never says "Verified".

export function SpotlightSheet({
  place,
  open,
  onClose,
  spotlight,
  onChanged,
}: {
  place: PlaceDetail;
  open: boolean;
  onClose: () => void;
  spotlight: PlaceSpotlight | null;
  onChanged: () => void;
}) {
  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel={`Spotlight ${place.name}`}>
      <SpotlightForm place={place} spotlight={spotlight} onChanged={onChanged} />
    </LocalSheet>
  );
}

function SpotlightForm({
  place,
  spotlight,
  onChanged,
}: {
  place: PlaceDetail;
  spotlight: PlaceSpotlight | null;
  onChanged: () => void;
}) {
  const getSupabase = useLazyBrowserSupabase();
  const [tier, setTier] = useState<SpotlightTier>("spotlight");
  const [interval, setBillingInterval] = useState<SpotlightInterval>("month");
  const [showName, setShowName] = useState(true);
  const [busy, setBusy] = useState(false);

  const current = spotlight ? SPOTLIGHT_TIER_LABEL[spotlight.tier] : null;
  const mine = (spotlight?.mine ?? []).filter((b) => b.live);

  async function start() {
    if (busy) return;
    setBusy(true);
    try {
      const url = await apiStartSpotlight(getSupabase(), {
        placeId: place.id,
        tier,
        interval,
        showName,
        returnUrl: `${window.location.origin}${window.location.pathname}`,
      });
      window.location.assign(url);
    } catch (err) {
      toast.error(errMsg(err, "Couldn't open checkout. Try again."));
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await apiCancelSpotlight(getSupabase(), id);
      toast("Your backing ends at the close of this period");
      onChanged();
    } catch (err) {
      toast.error(errMsg(err, "Couldn't cancel. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={SHEET_BODY_CLASS}>
      <div className="flex items-center gap-3">
        <span className="bg-pink-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className={SHEET_TITLE_CLASS}>Spotlight</h2>
          <p className="text-muted-foreground truncate text-xs">{place.name}</p>
        </div>
      </div>

      <p className="text-muted-foreground mt-4 text-sm">
        {current
          ? `${place.name} is in ${current}, backed by ${backedBy(spotlight!)}.`
          : `Back ${place.name} so more guests find it. Anyone can back a place, and backers add up.`}
      </p>

      {mine.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold">Your backing</p>
          <div className="mt-2">
            <SettingsGroup>
              {mine.map((b, i) => (
                <Fragment key={b.id}>
                  {i > 0 && <RowDivider />}
                  <div className="flex min-h-12 items-center gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{SPOTLIGHT_TIERS.find((t) => t.key === b.tier)?.label}</span>
                      <span className="text-muted-foreground block text-xs">
                        {b.cancel_at_period_end ? "Ends" : "Renews"} {formatDate(b.current_period_end)}
                      </span>
                    </span>
                    {!b.cancel_at_period_end && (
                      <button
                        type="button"
                        onClick={() => void cancel(b.id)}
                        disabled={busy}
                        className="text-destructive text-sm font-semibold disabled:opacity-60"
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

      <div className="bg-muted mt-5 grid grid-cols-2 gap-1 rounded-lg p-1" role="radiogroup" aria-label="Billing">
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
            {v === "month" ? "Monthly" : "Yearly"}
          </button>
        ))}
      </div>

      <div className="mt-3" role="radiogroup" aria-label="Tier">
        <SettingsGroup>
          {SPOTLIGHT_TIERS.map((t, i) => {
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
                  <span className="font-semibold">{spotlightPrice(t.monthly, interval)}</span>
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

      <button
        type="button"
        role="switch"
        aria-checked={showName}
        onClick={() => setShowName((v) => !v)}
        className="mt-3 flex w-full items-center gap-3 px-1 py-2 text-left text-sm"
      >
        <span className="min-w-0 flex-1">Show my first name as a backer</span>
        <Switch on={showName} />
      </button>

      <button
        type="button"
        onClick={() => void start()}
        disabled={busy}
        className={cn(PRIMARY_BUTTON_CLASS, "mt-4")}
      >
        {busy ? "Opening checkout…" : "Continue to payment"}
      </button>
      <p className="text-muted-foreground mt-3 text-center text-xs">
        Spotlight is paid visibility, not a verification. Cancel any time; it runs to the end of the period you paid for.
      </p>
    </div>
  );
}

/** "Ana, Luis and 2 others" — names first, then the unnamed backers. */
export function backedBy(s: Pick<PlaceSpotlight, "backers" | "names">): string {
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
