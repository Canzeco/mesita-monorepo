"use client";

import { useState } from "react";
import { PremierRosette } from "@mesita/place-profile";
import { BadgeCheck, ChevronRight, Loader2, Mail } from "lucide-react";
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
import { MESITA_HELLO_EMAIL } from "@/lib/mesita-contact";
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
// for any place (MESITA-3175) — 3 months of Premier 2X or Premier 5X (MESITA-3203),
// paid once, no renewal, no owner check. The recurring Subscription is the
// Business app's.
//
// It sells (MESITA-3189, Pato: "you are ultimately selling a product, so maybe
// explain current level and what to do"): one card of the three levels side by
// side (Pato picked it, MESITA-3203), so where the place is and where it can go
// are one look; 2X and 5X each have a Buy button straight to Checkout. Below,
// the ownership box: claim the place, or that it has an owner and who to write
// to, or that it is yours. It never names the owner. Every amount, date and line
// is the server's (consumer-web-get-premier-refill); nothing here computes money.
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
  const level = loading ? null : (boost?.level ?? 0);
  const lines = [
    ...packs.filter((p) => p.available && p.notice).map((p) => `${p.notice}.`),
    ...packs
      .filter((p) => !p.available)
      .map((p) => (p.code && START_REFUSED[p.code]) ?? "Not for sale here now."),
  ];

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
      <div aria-live="polite">
        <p className="font-semibold">Visibility for 3 months</p>
        {!loading &&
          statusLines(boost).map((line) => (
            <p key={line} className="text-muted-foreground text-sm">
              {line}
            </p>
          ))}
      </div>

      <div className="border-border bg-card divide-border grid grid-cols-3 divide-x rounded-2xl border">
        <div className="flex min-w-0 flex-col p-3">
          <span className="h-5" />
          <p className="mt-1 text-2xl font-semibold tracking-tight">{VISIBILITY[0]}</p>
          <p className="text-muted-foreground text-sm">Free</p>
          {level === 0 ? (
            <span className="bg-muted text-muted-foreground mt-3 flex h-11 items-center justify-center rounded-lg text-sm font-semibold">
              Now
            </span>
          ) : null}
        </div>
        {BOOST_TIERS.map((t) => {
          const p = packs.find((x) => x.tier === t.rank);
          const off = !loading && !!p && !p.available;
          return (
            <div key={t.rank} className="flex min-w-0 flex-col p-3">
              <span className="flex h-5 items-center gap-1.5">
                <PremierRosette />
                {level === t.rank ? <span className="text-muted-foreground text-sm">Now</span> : null}
              </span>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{VISIBILITY[t.rank]}</p>
              <p className="text-muted-foreground text-sm tabular-nums">{p ? money(p.price_cents) : "…"}</p>
              <button
                type="button"
                onClick={() => void start(t.rank)}
                disabled={loading || !p || off || starting !== null || !boost?.signed_in}
                aria-label={p ? `Buy ${VISIBILITY[t.rank]} visibility for ${money(p.price_cents)}` : undefined}
                className={cn(
                  PRIMARY_BUTTON_CLASS,
                  "mt-3 h-11",
                  off ? "bg-muted text-muted-foreground" : "bg-destructive text-destructive-foreground",
                )}
              >
                {starting === t.rank ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Buy"}
              </button>
            </div>
          );
        })}
      </div>

      {[...new Set(lines)].map((line) => (
        <p key={line} className="text-muted-foreground text-sm">
          {line}
        </p>
      ))}
      {startError ? <p className={ERROR_BOX_CLASS}>{startError}</p> : null}
      {boost && !boost.signed_in ? (
        <p className="text-muted-foreground text-sm">Sign in to upgrade this place.</p>
      ) : null}

      <p className="text-muted-foreground text-sm">
        Moves the place up in Mesita, with no guarantee of more views. It shows an “Ad” label and doesn&apos;t verify the
        place. Starts after any days already running. Charged once by Stripe in US dollars; nothing renews.
      </p>

      {boost ? <OwnerBox place={place} owner={boost.owner ?? "none"} /> : null}

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

/** Who runs the place (Pato, MESITA-3203: "a box to claim ownership, and if
 *  already has an owner, like mention it, and contact mail"). The claim door
 *  lands an owner on the place and lets anyone else claim it. */
function OwnerBox({
  place,
  owner,
}: {
  place: PlaceDetail;
  owner: NonNullable<PlaceBoost["owner"]>;
}) {
  const other = owner === "other";
  const Icon = other ? Mail : ChevronRight;
  return (
    <a
      href={
        other
          ? `mailto:${MESITA_HELLO_EMAIL}?subject=${encodeURIComponent(`Ownership of ${place.name}`)}`
          : businessClaimHref(place.id)
      }
      {...(other ? {} : { target: "_blank", rel: "noopener" })}
      className="border-border bg-card flex min-h-16 items-center gap-3 rounded-2xl border p-4"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">
          {other ? "This place has an owner" : owner === "you" ? "You run this place" : "Is this your place?"}
        </span>
        <span className="text-muted-foreground block text-sm">
          {other
            ? `Think that's wrong? Write to ${MESITA_HELLO_EMAIL}`
            : owner === "you"
              ? "Open it in Mesita Business."
              : "Claim it in Mesita Business to edit its page, reviews and plan."}
        </span>
      </span>
      <Icon className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
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
