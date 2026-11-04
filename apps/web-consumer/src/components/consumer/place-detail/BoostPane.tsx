"use client";

import { useState } from "react";
import { PremierRosette } from "@mesita/place-profile";
import { BadgeCheck, ChevronRight, Loader2 } from "lucide-react";
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
import { businessClaimHref } from "@/lib/business-url";
import type { PlaceDetail } from "@/lib/place-detail";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import {
  ERROR_BOX_CLASS,
  PRIMARY_BUTTON_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

// THE UPGRADE SHEET'S BODY (MESITA-3168; boxes MESITA-3107, Premier MESITA-2925;
// the place's fourth tab from MESITA-2861 until the sheet, MESITA-3201, see
// BoostSheet). Pato, 2026-11-03: a guest buys an Upgrade
// for any place (MESITA-3175) — 30 days of Premier 2X or Premier 5X,
// paid once, no renewal, no owner check. The recurring Subscription is the
// Business app's.
//
// It sells (MESITA-3189, Pato: "you are ultimately selling a product, so maybe
// explain current level and what to do"; MESITA-3194: "like two products"): one
// big box with the place's current visibility and the two Upgrades, each with its
// own Buy button straight to Checkout; below it, one box to manage the place in
// the Business app (its claim door: an owner lands on the place, anyone else can
// claim it). Every amount, date and line is the
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
  const [startError, setStartError] = useState<string | null>(null);

  const packs = boost?.packs ?? [];
  const notices = [...new Set(packs.filter((p) => p.available && p.notice).map((p) => p.notice))];
  const claimHref = businessClaimHref(place.id);

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
      setStartError(refusal(err, "Couldn't open checkout. Try again."));
      setStarting(null);
    }
  }

  return (
    <section className="mt-5 flex flex-col gap-3" aria-labelledby="boost-title">
      <div className="border-border bg-card rounded-2xl border p-4">
        <div aria-live="polite">
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

        <hr className="border-border my-4" />

        <p className="font-semibold">Upgrade it for 30 days</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm">
          <PremierRosette />
          With the Premier red tag
        </p>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {BOOST_TIERS.map((t) => {
            const p = packs.find((x) => x.tier === t.rank);
            const off = !loading && !!p && !p.available;
            return (
              <div key={t.rank} className="border-border flex flex-col rounded-xl border p-3">
                <p className="text-2xl font-semibold tracking-tight">{VISIBILITY[t.rank]}</p>
                <p className="text-muted-foreground text-sm">visibility</p>
                <p className="mt-3 mb-3 font-semibold tabular-nums">{p ? money(p.price_cents) : "…"}</p>
                {off ? (
                  <p className="text-muted-foreground mt-auto text-sm">
                    {(p.code && START_REFUSED[p.code]) ?? "Not for sale here now."}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void start(t.rank)}
                    disabled={loading || !p || starting !== null || !boost?.signed_in}
                    aria-label={p ? `Buy ${VISIBILITY[t.rank]} visibility for ${money(p.price_cents)}` : undefined}
                    className={cn(PRIMARY_BUTTON_CLASS, "bg-destructive text-destructive-foreground mt-auto h-11")}
                  >
                    {starting === t.rank ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Buy"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {notices.map((n) => (
          <p key={n} className="text-muted-foreground mt-3 text-sm">
            {n}.
          </p>
        ))}
        {startError ? <p className={cn(ERROR_BOX_CLASS, "mt-3")}>{startError}</p> : null}
        {boost && !boost.signed_in ? (
          <p className="text-muted-foreground mt-3 text-sm">Sign in to upgrade this place.</p>
        ) : null}

        <p className="text-muted-foreground mt-3 text-sm">
          Visibility is ranking priority: it moves the place up but doesn&apos;t guarantee more views. Upgraded places
          show “Ad”, and an Upgrade doesn&apos;t verify a place. It runs after any days already running. Charged once by
          Stripe in US dollars; nothing renews.
        </p>
      </div>

      {claimHref ? (
        <a
          href={claimHref}
          target="_blank"
          rel="noopener"
          className="border-border bg-card flex min-h-16 items-center gap-3 rounded-2xl border p-4"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Manage this place</span>
            <span className="text-muted-foreground block text-sm">Open Mesita Business to edit its page, reviews and plan.</span>
          </span>
          <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
        </a>
      ) : null}

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
  if (!boost || boost.level === 0) return [];
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
      text: `Upgrade ${tierLabel(tier)} · ${sources.join(", ")} · until ${shortDate(ends)}`,
    });
  }
  const sub = boost.subscription;
  if (sub) {
    lines.push({ tier: sub.tier, text: `${tierLabel(sub.tier)} · the place's plan` });
  }
  return lines.sort((x, y) => y.tier - x.tier).map((l) => l.text);
}

/** The Upgrade sheet on a Google-only card (MESITA-2797): no Mesita row, so
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
