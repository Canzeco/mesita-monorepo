"use client";

import { useState } from "react";
import { PremierRosette } from "@mesita/place-profile";
import { BadgeCheck, Loader2 } from "lucide-react";
import { EFError } from "@/lib/api/_invoke";
import {
  apiStartRefill,
  tierLabel,
  BOOST_TIERS,
  money,
  shortDate,
  START_REFUSED,
  type PlaceBoost,
  type RefillDays,
  type TierRank,
} from "@/lib/api/boost";
import type { PlaceDetail } from "@/lib/place-detail";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import {
  ERROR_BOX_CLASS,
  PRIMARY_BUTTON_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

// THE PREMIER TAB (MESITA-3168; boxes MESITA-3107, Premier MESITA-2925, the
// place's fourth tab MESITA-2861). Pato, 2026-11-03: a guest buys a Boost
// for any place (MESITA-3175) — 30 days of Premier 2X or Premier 5X,
// paid once, no renewal, no owner check. The recurring Subscription is the
// Business app's.
//
// It sells (MESITA-3189, Pato: "you are ultimately selling a product, so maybe
// explain current level and what to do"): the place's current visibility, then
// the two Boosts on the tab, each one button away from Checkout. "Is this your
// business?" is in the place's ⋯ menu. Every amount, date and line is the
// server's (consumer-web-get-premier-refill); nothing here computes money.
// Premier is paid ranking priority: it never verifies the place and never
// promises views.

/** A Premier level as visibility: 0 is where every place starts. */
const VISIBILITY: Record<number, string> = { 0: "1X", 1: "2X", 2: "5X" };

const ORIGIN: Record<RefillDays["source"], string> = {
  admin: "by Mesita",
  purchase: "bought by a guest",
};

export function BoostPane({
  place,
  boost,
  loading,
  failed,
  onRetry,
}: {
  place: PlaceDetail;
  boost: PlaceBoost | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const getSupabase = useLazyBrowserSupabase();
  const [starting, setStarting] = useState<TierRank | null>(null);
  const [startError, setStartError] = useState<{ tier: TierRank; text: string } | null>(null);

  const packs = boost?.packs ?? [];

  async function start(tier: TierRank) {
    if (starting) return;
    setStarting(tier);
    setStartError(null);
    try {
      const res = await apiStartRefill(getSupabase(), {
        placeId: place.id,
        tier,
        returnUrl: `${window.location.origin}${window.location.pathname}`,
      });
      window.location.assign(res.url);
    } catch (err) {
      setStartError({ tier, text: refusal(err, "Couldn't open checkout. Try again.") });
      setStarting(null);
    }
  }

  return (
    <section className="flex flex-col gap-4 py-2" aria-labelledby="boost-title">
      <h2 id="boost-title" className="sr-only">
        Business
      </h2>

      <div className="border-border bg-card rounded-2xl border p-4" aria-live="polite">
        <p className="text-muted-foreground text-sm">Current level</p>
        <p className="text-2xl font-semibold tracking-tight">
          {loading ? "…" : `${VISIBILITY[boost?.level ?? 0] ?? "1X"} visibility`}
        </p>
        {!loading &&
          statusLines(boost).map((line) => (
            <p key={line} className="text-muted-foreground text-sm">
              {line}
            </p>
          ))}
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h3 className="font-semibold">Boost this place</h3>
          <p className="text-muted-foreground text-sm">
            Move it up on Home and the Map for 30 days. Paid once, nothing renews.
          </p>
        </div>

        {BOOST_TIERS.map((t) => {
          const p = packs.find((x) => x.tier === t.rank);
          const off = !loading && !!p && !p.available;
          return (
            <div key={t.rank} className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4">
              <div>
                <p className="text-2xl font-semibold tracking-tight">{VISIBILITY[t.rank]} visibility</p>
                <p className="mt-1 flex items-center gap-1.5">
                  <PremierRosette />
                  Premier red tag
                </p>
              </div>
              {p?.notice ? <p className="text-muted-foreground text-sm">{p.notice}.</p> : null}
              {startError?.tier === t.rank ? <p className={ERROR_BOX_CLASS}>{startError.text}</p> : null}
              {off ? (
                <p className="text-muted-foreground text-sm">
                  {(p.code && START_REFUSED[p.code]) ?? "Not for sale here now."}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => void start(t.rank)}
                  disabled={loading || !p || starting !== null || !boost?.signed_in}
                  className={cn(PRIMARY_BUTTON_CLASS, "inline-flex items-center justify-center gap-2")}
                >
                  {starting === t.rank && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {starting === t.rank ? "Opening…" : p ? `Boost for ${money(p.price_cents)}` : "Boost"}
                </button>
              )}
            </div>
          );
        })}

        {boost && !boost.signed_in && (
          <p className="text-muted-foreground text-sm">Sign in to boost this place.</p>
        )}

        <p className="text-muted-foreground text-sm">
          Visibility is ranking priority: it moves the place up but doesn&apos;t guarantee more views. Boosted places
          show “Ad”, and a Boost doesn&apos;t verify a place. It runs after any days already running. Charged once by
          Stripe in US dollars; card only.
        </p>
      </div>

      {failed && (
        <div className={ERROR_BOX_CLASS} role="alert">
          Couldn&apos;t load this place&apos;s Premier.{" "}
          <button type="button" onClick={onRetry} className="font-semibold underline">
            Try again
          </button>
        </div>
      )}
    </section>
  );
}

/** A refused start in one line, from the server's code. */
function refusal(err: unknown, fallback: string): string {
  if (err instanceof EFError && err.code && START_REFUSED[err.code])
    return START_REFUSED[err.code];
  return errMsg(err, fallback);
}

/** What runs the place's level now, highest first, then what runs after it. */
function statusLines(boost: PlaceBoost | null): string[] {
  if (!boost || boost.level === 0) return ["Not Premier. Every place starts here."];
  const lines: Array<{ tier: number; text: string }> = [];
  // Refill days, one line per tier: 5X runs first, then 2X.
  for (const tier of [2, 1]) {
    const rows = boost.refill.filter((r) => r.tier === tier);
    if (rows.length === 0) continue;
    const ends = rows.reduce(
      (max, r) => (r.ends_at > max ? r.ends_at : max),
      rows[0].ends_at,
    );
    const sources = [...new Set(rows.map((r) => ORIGIN[r.source]))];
    lines.push({
      tier,
      text: `Boost ${tierLabel(tier)} · ${sources.join(", ")} · until ${shortDate(ends)}`,
    });
  }
  const sub = boost.subscription;
  if (sub) {
    lines.push({ tier: sub.tier, text: `${tierLabel(sub.tier)} · the place's plan` });
  }
  return lines.sort((x, y) => y.tier - x.tier).map((l) => l.text);
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
