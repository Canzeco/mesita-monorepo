"use client";

import { useState } from "react";
import { PremierRosette } from "@mesita/place-profile";
import { BadgeCheck, ChevronRight, Loader2, Phone, Rocket } from "lucide-react";
import { EFError } from "@/lib/api/_invoke";
import {
  apiStartRefill,
  suitePlanName,
  BOOST_TIERS,
  money,
  shortDate,
  START_REFUSED,
  type PlaceBoost,
  type RefillDays,
  type RefillPack,
  type TierRank,
} from "@/lib/api/boost";
import { businessClaimHref } from "@/lib/business-url";
import { MESITA_PHONE, MESITA_PHONE_TEL } from "@/lib/mesita-contact";
import type { PlaceDetail } from "@/lib/place-detail";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import {
  ERROR_BOX_CLASS,
  INFO_BOX_CLASS,
  PRIMARY_BUTTON_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

// THE UPGRADE SHEET'S BODY (MESITA-3168; Premier MESITA-2925; the place's fourth
// tab from MESITA-2861 until the sheet, MESITA-3201, see BoostSheet). A guest buys
// an Upgrade for any place (MESITA-3175): one year of Premier 2X or Premier 5X
// (MESITA-3386; 3 months from MESITA-3203 until then), paid once, no renewal, no owner check. The recurring Subscription
// is the Business app's.
//
// It reads top to bottom (MESITA-3257, Pato picked the rows and every line): who
// it's for, one spot for messages, one card with a row per plan in Business ›
// the plans' names (Mesita Free, Pro, Max, MESITA-3329; the perk is Premier: visibility
// and the red tag), the terms in small type, then the owner box. Buy and Now
// share one slot, and a reason a plan can't be bought stays in that plan's
// row. Every amount, date and refusal is the server's
// (consumer-web-get-premier-refill); nothing here computes money. Premier is
// paid ranking priority: it never verifies the place.
//
// EACH ROW IS A CATALOG CARD (Pato, MESITA-3336: "better design for this
// promotions"), the Promos tab's shape (MESITA-3326): a square face at the
// left with the plan's level as a badge (grey rocket for Free, the red Premier
// rosette on red for Pro and Max), the name, the perk line, and the price in
// bold, since the price is what a guest decides on; the button at the right.

/** A Premier level as visibility, in words a guest gets at once (Pato,
 *  MESITA-3906: "Free: organic visibility, Pro: High visibility boost, Max: Max
 *  visibility boost", in place of 1X · 2X · 5X). 0 is where every place starts. */
const VISIBILITY: Record<number, string> = {
  0: "Organic visibility",
  1: "High visibility boost",
  2: "Max visibility boost",
};

const BOX_CLASS = "border-border bg-card overflow-hidden rounded-xl border";
const ROW_CLASS = "flex items-center gap-3 p-3";
/** A plan's face: 56px square. No level badge on its corner since
 *  MESITA-3374 (Pato: "this feels redundant"): the perk line says the
 *  level once. */
const FACE_CLASS =
  "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg";
/** One width for Buy and Now, so the column reads as one edge. */
const SLOT_CLASS = "w-[76px] shrink-0";

/** What a guest should know before paying: the money, nothing else (Pato,
 *  MESITA-3915: "delete the it doesn't guarantee more views"). */
const TERMS =
  "One year. Charged once by Stripe, in US dollars. Nothing renews. Starts after any days already running.";

const ORIGIN: Record<RefillDays["source"], string> = {
  admin: "Added by Mesita",
  purchase: "Bought by a guest",
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
  const level = loading || !boost ? null : boost.level;
  const messages = loading ? [] : statusLines(boost);
  if (boost && !boost.signed_in) messages.push("Sign in to upgrade this place.");

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
      <p className="text-muted-foreground text-sm">
        Move this place up on Mesita. Anyone can buy this for it.
      </p>

      <div className="flex flex-col gap-2 empty:hidden" aria-live="polite">
        {failed && (
          <div className={cn(ERROR_BOX_CLASS, "text-sm")} role="alert">
            Couldn&apos;t load the plans for this place.{" "}
            <button type="button" onClick={onRetry} className="font-semibold underline">
              Try again
            </button>
          </div>
        )}
        {startError ? <p className={cn(ERROR_BOX_CLASS, "text-sm")}>{startError}</p> : null}
        {messages.map((line) => (
          <p key={line} className={cn(INFO_BOX_CLASS, "text-foreground text-sm")}>
            {line}
          </p>
        ))}
      </div>

      <div className={cn(BOX_CLASS, "divide-border divide-y")}>
        <div className={ROW_CLASS}>
          <PlanFace rank={0} />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">{suitePlanName(0)}</p>
            <p className="text-muted-foreground">{VISIBILITY[0]}</p>
            <p className="font-semibold tabular-nums">$0 USD</p>
          </div>
          {level === 0 ? (
            <span
              className={cn(
                SLOT_CLASS,
                "bg-muted text-muted-foreground flex h-11 items-center justify-center rounded-lg text-sm font-semibold",
              )}
            >
              Now
            </span>
          ) : null}
        </div>
        {BOOST_TIERS.map((t) => {
          const p = packs.find((x) => x.tier === t.rank);
          const off = !loading && !!p && !p.available;
          const reason = loading ? null : packReason(p);
          const name = suitePlanName(t.rank);
          return (
            <div key={t.rank} className={ROW_CLASS}>
              <PlanFace rank={t.rank} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">{name}</p>
                {/* Words alone (MESITA-3374): the face already wears the
                    rosette, so the line does not repeat it. */}
                <p className="text-muted-foreground">{VISIBILITY[t.rank]}, Premier red tag</p>
                <p className="font-semibold tabular-nums">
                  {p ? (
                    `${money(p.price_cents)} USD for one year`
                  ) : (
                    <span className="bg-muted inline-block h-3.5 w-24 rounded align-middle" />
                  )}
                </p>
                {reason ? <p className="text-foreground mt-1">{reason}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => void start(t.rank)}
                disabled={loading || !p || off || starting !== null || !boost?.signed_in}
                aria-label={p ? `Buy one year of ${name}, ${VISIBILITY[t.rank]}, for ${money(p.price_cents)} USD` : undefined}
                className={cn(
                  PRIMARY_BUTTON_CLASS,
                  SLOT_CLASS,
                  "h-11",
                  off && "bg-muted text-muted-foreground",
                )}
              >
                {starting === t.rank ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Buy"}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">{TERMS}</p>

      {boost ? <OwnerBox place={place} owner={boost.owner ?? "none"} /> : null}
    </section>
  );
}

/** A plan's face: the Premier rosette on red for a paid plan, a grey rocket
 *  for Free. Decorative: the row's text says the level. */
function PlanFace({ rank }: { rank: number }) {
  const premier = rank > 0;
  return (
    <span
      className={cn(FACE_CLASS, premier ? "bg-red-100" : "bg-muted text-muted-foreground")}
      aria-hidden
    >
      {premier ? (
        <PremierRosette className="h-7 w-7" />
      ) : (
        <Rocket className="h-6 w-6" strokeWidth={1.75} />
      )}
    </span>
  );
}

/** Why this plan can't be bought, or what buying it will do: the server's words. */
function packReason(p: RefillPack | undefined): string | null {
  if (!p) return null;
  if (!p.available) return (p.code && START_REFUSED[p.code]) ?? "Not for sale here now.";
  return p.notice ? `${p.notice}.` : null;
}

/** Who runs the place, small, under the terms (Pato, MESITA-3336: "a box
 *  below: is this business yours??? below in small"; MESITA-3203's bigger
 *  box left the sheet in MESITA-3329 "for clarity"). The claim door lands an
 *  owner on the place and lets anyone else claim it. */
function OwnerBox({
  place,
  owner,
}: {
  place: PlaceDetail;
  owner: NonNullable<PlaceBoost["owner"]>;
}) {
  const other = owner === "other";
  const Icon = other ? Phone : ChevronRight;
  return (
    <a
      href={
        other
          ? MESITA_PHONE_TEL
          : businessClaimHref(place.id)
      }
      {...(other ? {} : { target: "_blank", rel: "noopener" })}
      className={cn(BOX_CLASS, "flex items-center gap-3 px-3 py-2.5")}
    >
      <span className="min-w-0 flex-1 text-xs">
        <span className="text-foreground block font-semibold">
          {other
            ? "This business has an owner"
            : owner === "you"
              ? "You run this business"
              : "Is this business yours?"}
        </span>
        <span className="text-muted-foreground block">
          {other
            ? `Think that's wrong? Call Mesita at ${MESITA_PHONE}`
            : owner === "you"
              ? "Open it in Mesita Business."
              : "Claim it in Mesita Business to edit its page, reviews and plan."}
        </span>
      </span>
      <Icon className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
    </a>
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
      text: `${suitePlanName(tier)} until ${shortDate(ends)}. ${sources.join(". ")}.`,
    });
  }
  const sub = boost.subscription;
  if (sub) {
    lines.push({ tier: sub.tier, text: `${suitePlanName(sub.tier)} is this place's plan.` });
  }
  return lines.sort((x, y) => y.tier - x.tier).map((l) => l.text);
}

/** The Upgrade sheet on a Google-only card (MESITA-2797): no Mesita row, so
 *  nothing to buy yet. */
export function BoostUnavailable() {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="bg-muted text-foreground flex h-14 w-14 items-center justify-center rounded-xl">
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
