"use client";

import { useState } from "react";
import { BadgeCheck, ChevronRight, Loader2, Rocket, Store } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
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
import { MAP_PREMIER_PIN_COLOR } from "@/lib/map-defaults";
import type { PlaceDetail } from "@/lib/place-detail";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import {
  ERROR_BOX_CLASS,
  PRIMARY_BUTTON_CLASS,
  SHEET_BODY_CLASS,
  SHEET_TITLE_CLASS,
} from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

// THE PREMIER TAB (MESITA-3168; boxes MESITA-3107, Premier MESITA-2925, the
// place's fourth tab MESITA-2861). Pato, 2026-11-03: a guest buys Premier
// days for any place — a 30-day pack of Premier (2X) or Premier Max (5X),
// paid once, no renewal, no owner check. The recurring Subscription is the
// Business app's.
//
// Three boxes: the place's Premier level on a 0–3 meter (level 3 reads
// "Soon": the database allows 0–2, MESITA-3041) with what lifts it now;
// "Buy Premier days", one row that opens a sheet with the perks, the two
// packs and ONE pay button; and "Is this your business?", the Business app's
// claim page. Every amount, date and line is the server's
// (consumer-web-get-premier-refill); nothing here computes money. Premier is
// paid ranking priority: it never verifies the place and never promises
// views.

/** The level meter's three steps above 0: the two packs, then "Soon". */
const LEVELS: ReadonlyArray<{ rank: number; label: string; soon?: boolean }> = [
  ...BOOST_TIERS.map((t) => ({
    rank: t.rank,
    label: `${t.label} · ${t.priority}`,
  })),
  { rank: 3, label: "Soon", soon: true },
];

/** What a pack buys, said in the sheet above the packs. */
const PERKS = [
  "Moves the place up on Home and the Map: 2X priority with Premier, 5X with Premier Max.",
  "A red Premier pin on the Map.",
  "Paid once for 30 days. Nothing renews; it ends on its own.",
];

const ORIGIN: Record<RefillDays["source"], string> = {
  admin: "by Mesita",
  code: "from a code",
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [picked, setPicked] = useState<TierRank | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const level = boost?.level ?? 0;
  const live = level > 0;
  const status = statusLines(boost);
  const packs = boost?.packs ?? [];
  const forSale = packs.filter((p) => p.available);
  const pack = packs.find((p) => p.tier === picked) ?? null;
  const claimHref = businessClaimHref(place.id);
  const returnUrl = () =>
    `${window.location.origin}${window.location.pathname}`;

  async function start() {
    if (!pack || starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const res = await apiStartRefill(getSupabase(), {
        placeId: place.id,
        tier: pack.tier,
        returnUrl: returnUrl(),
      });
      window.location.assign(res.url);
    } catch (err) {
      setStartError(refusal(err, "Couldn't open checkout. Try again."));
      setStarting(false);
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
          {!loading &&
            (status.sub.length > 0 ? (
              status.sub.map((line) => (
                <span
                  key={line}
                  className="text-muted-foreground block text-xs"
                >
                  {line}
                </span>
              ))
            ) : !live ? (
              <span className="text-muted-foreground block text-xs">
                Premier moves a place up on Home and the Map.
              </span>
            ) : null)}
        </p>
      </div>

      {/* Box 2: buy days; the sheet holds the packs and the button. */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        disabled={loading}
        className="border-border bg-card flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99] disabled:opacity-60"
      >
        <span className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <Rocket className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">
            Buy Premier days
          </span>
          <span className="text-muted-foreground block text-xs">
            {packLine(boost, forSale.length > 0)}
          </span>
        </span>
        <ChevronRight
          className="text-muted-foreground h-5 w-5 shrink-0"
          aria-hidden
        />
      </button>

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
        ariaLabel="Buy Premier days"
      >
        <div className={SHEET_BODY_CLASS}>
          <h2 className={SHEET_TITLE_CLASS}>Mesita Premier</h2>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Buy 30 days that move {place.name} up for every guest.
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

          <div className="mt-4 flex flex-col gap-3">
            <h3 className="type-eyebrow text-muted-foreground">
              Make it Premier
            </h3>
            <div
              className="flex flex-col gap-2"
              role="radiogroup"
              aria-label="Premier pack"
            >
              {BOOST_TIERS.map((t) => {
                const p = packs.find((x) => x.tier === t.rank);
                const on = picked === t.rank;
                const off = !p?.available;
                return (
                  <button
                    key={t.rank}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={off}
                    onClick={() => {
                      setPicked(t.rank);
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
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {off && p?.code
                          ? (START_REFUSED[p.code] ?? "Not for sale here now.")
                          : t.blurb}
                      </span>
                    </span>
                    {p && (
                      <span className="text-sm font-semibold whitespace-nowrap">
                        {money(p.price_cents)}
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          · {p.days} days
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {boost && !boost.signed_in && (
              <p className="text-muted-foreground text-xs">
                Sign in to make this place Premier.
              </p>
            )}

            {pack && (
              <div className="flex flex-col gap-2">
                {pack.notice && (
                  <p
                    className="bg-muted rounded-xl px-3 py-2 text-sm leading-relaxed"
                    aria-live="polite"
                  >
                    {pack.notice}.
                  </p>
                )}
                {startError && <p className={ERROR_BOX_CLASS}>{startError}</p>}
                <button
                  type="button"
                  onClick={() => void start()}
                  disabled={starting || !boost?.signed_in}
                  className={cn(
                    PRIMARY_BUTTON_CLASS,
                    "inline-flex items-center justify-center gap-2",
                  )}
                >
                  {starting && (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  )}
                  {starting ? "Opening…" : `Pay ${money(pack.price_cents)}`}
                </button>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {money(pack.price_cents)} once for {pack.days} days of{" "}
                  {tierLabel(pack.tier)}. Nothing renews.
                </p>
              </div>
            )}

            <p className="text-muted-foreground text-xs leading-relaxed">
              Premier gives the place 2X ranking priority on Home and the Map,
              Premier Max 5X. Priority moves it up the list; it doesn&apos;t
              guarantee more views. Premier places show “Ad”; Premier
              doesn&apos;t verify a place. Days you buy stack after the days
              already running. Charged once by Stripe in US dollars; card only.
            </p>
          </div>
        </div>
      </LocalSheet>
    </section>
  );
}

/** A refused start in one line, from the server's code. */
function refusal(err: unknown, fallback: string): string {
  if (err instanceof EFError && err.code && START_REFUSED[err.code])
    return START_REFUSED[err.code];
  return errMsg(err, fallback);
}

/** The status: what lifts the place now first, then what runs after it. */
function statusLines(boost: PlaceBoost | null): {
  head: string;
  sub: string[];
} {
  if (!boost || boost.level === 0) return { head: "Not Premier", sub: [] };
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
      text: `${tierLabel(tier)} · ${sources.join(", ")} · until ${shortDate(ends)}`,
    });
  }
  const s = boost.subscription;
  if (s) {
    lines.push({
      tier: s.tier,
      text: `${tierLabel(s.tier)} · the place's plan`,
    });
  }
  lines.sort((a, b) => b.tier - a.tier);
  if (lines.length === 0) return { head: `${tierLabel(boost.level)}`, sub: [] };
  return { head: lines[0].text, sub: lines.slice(1).map((l) => l.text) };
}

/** The buy box's one line: the lowest price, or why nothing is for sale. */
function packLine(boost: PlaceBoost | null, anyForSale: boolean): string {
  if (!boost) return "Packs and prices";
  if (!anyForSale) {
    const code = boost.packs.find((p) => p.code)?.code;
    return (code && START_REFUSED[code]) ?? "Not for sale here now";
  }
  const prices = boost.packs
    .filter((p) => p.available)
    .map((p) => p.price_cents);
  return `From ${money(Math.min(...prices))} · 30 days of 2X or 5X priority`;
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
