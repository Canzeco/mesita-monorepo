"use client";

// Premier as one table (MESITA-3638, Pato: "still looks like shit. fully
// redesign this page with a better UI"; he picked the one-table board). One
// full-width card says each thing once:
//   · the level the place runs at ("2X visibility", the red seal above 1X)
//     and one line saying why (statusLine, lib/plans.ts), then the Checkout
//     outcome after a Stripe return;
//   · Free · Pro · Max as rows that share five columns (name, visibility,
//     tag, price, action), the plan the place is on tinted;
//   · the Upgrade as the last row, in the same columns.
// It replaces the status card, the three plan boxes (PlansCard, MESITA-3183,
// 3632) and the separate Stop it card (MESITA-3103): a guest-paid plan's row
// holds Stop it. Buying is the one solid button; going down to Free and Stop
// it are quiet outlines with a second tap.
// The columns follow the card's own width (@container), never the viewport:
// under 48rem of card each row stacks.
// Two sizes only: the level in the headline size, the rest text-sm. Pro and
// Max are the boost_2x / boost_5x subscriptions; guests see them marked Ad
// (package law). Plans are yearly only (MESITA-3285).
//
// Every amount, date and state is the server's (business-web-get-premier);
// this file never computes money.

import { PremierRosette } from "@mesita/place-profile";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cancelPremier, getPremier, startPremier, type BoostTier, type PlacePremier } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { day } from "@/lib/format";
import { FREE_PLAN, FREE_VISIBILITY, PLAN_NAME, PLAN_VISIBILITY, shownLevel, statusLine } from "@/lib/plans";
import { ORIGIN_OF_SOURCE, REFILL_ORIGIN } from "@/lib/premier-origin";
import { premierHref, returnUrl } from "@/lib/routes";
import { cn } from "@/lib/utils";

const LEVELS = ["1X", "2X", "5X"] as const;

const PLANS: Array<{ key: BoostTier; rank: number }> = [
  { key: "boost_2x", rank: 1 },
  { key: "boost_5x", rank: 2 },
];

const OUTCOME: Record<string, string> = {
  confirmed: "Your plan is on. Thank you.",
  declined: "The card was declined. Nothing was charged.",
  covered: "Mesita already gives this place that level. Nothing was charged.",
  pending: "Your payment is being confirmed. Reload in a minute to see it.",
  expired: "That checkout expired. Nothing was charged.",
  lost: "Someone else started a plan first. Nothing was charged.",
};

const REFUSED: Record<string, string> = {
  covered_by_mesita: "Mesita already gives this place that level. Nothing was charged.",
  premier_taken: "A guest already pays for Premier here. Stop their subscription first, then choose a plan.",
  charging: "A renewal is being charged. Try again in a few minutes.",
  not_payer: "Only the person who pays can update the card.",
  lost: "Your plan changed while you were choosing. Look again.",
  interval_retired: "Plans are yearly only now. Reload the page and choose again.",
};

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// One grid for every row, so the columns line up. Stacked first (name and
// price, then visibility and tag, then the action); five columns from 48rem
// of card width, where `order` puts the price after the tag.
const ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-5 py-4 text-sm sm:px-6 @3xl:min-h-19 @3xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)_10.5rem] @3xl:items-center @3xl:gap-x-6 @3xl:py-3";
const SLOT = "col-span-2 mt-2 @3xl:order-5 @3xl:col-span-1 @3xl:mt-0";
const BUTTON = "h-11 w-full rounded-full font-semibold focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50";
const SOLID = "bg-foreground text-background hover:opacity-90";
const QUIET = "border-border hover:bg-muted border";

type Action = { label: string; run: () => void; onBlur?: () => void; armed?: boolean; quiet?: boolean };

function Seal() {
  return (
    <span className="flex items-center gap-1.5">
      <PremierRosette />
      Premier red tag
    </span>
  );
}

function Row({
  name,
  visibility,
  premier,
  price,
  note,
  word,
  action,
  busy,
  busyLabel,
  error,
  tinted,
  rowRef,
}: {
  name: string;
  visibility: string;
  /** Wears the red Premier mark. */
  premier: boolean;
  price: React.ReactNode;
  note?: string | null;
  /** With no `action`, where the row stands. */
  word: string;
  action: Action | null;
  busy: boolean;
  busyLabel?: string | null;
  error?: string | null;
  /** The plan the place is on. */
  tinted?: boolean;
  rowRef?: React.Ref<HTMLLIElement>;
}) {
  return (
    <li ref={rowRef} className={cn(ROW, tinted && "bg-muted/60")}>
      <p className="font-semibold @3xl:order-1">{name}</p>
      <div className="text-right @3xl:order-4 @3xl:text-left">
        <p>{price}</p>
        {note ? <p className="text-muted-foreground">{note}</p> : null}
      </div>
      <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 @3xl:contents">
        <p className="@3xl:order-2">
          <span className="font-semibold">{visibility}</span> visibility
        </p>
        <p className={cn("@3xl:order-3", !premier && "text-muted-foreground")}>{premier ? <Seal /> : "No Premier tag"}</p>
      </div>
      <div className={SLOT}>
        {action ? (
          <button
            type="button"
            disabled={busy}
            onClick={action.run}
            onBlur={action.onBlur}
            className={cn(BUTTON, action.quiet ? QUIET : SOLID, action.armed && "text-destructive")}
          >
            {busyLabel ?? action.label}
          </button>
        ) : word ? (
          <p className="text-muted-foreground font-medium @3xl:text-center">{word}</p>
        ) : null}
      </div>
      {error ? (
        <p className="text-destructive col-span-2 @3xl:order-6 @3xl:col-span-5" aria-live="polite">
          {error}
        </p>
      ) : null}
    </li>
  );
}

type Tapped = BoostTier | "free" | "stop";

export function PremierPanel({
  placeId,
  initial,
  loadError,
  picked = null,
}: {
  placeId: string;
  initial: PlacePremier | null;
  loadError: string | null;
  /** A plan picked by `?plan=` (Keep links). */
  picked?: BoostTier | null;
}) {
  const router = useRouter();
  const [data, setData] = useState<PlacePremier | null>(initial);
  // The tapped row while its request runs.
  const [busy, setBusy] = useState<Tapped | null>(null);
  // A refusal belongs to the row that was tapped; null = no row.
  const [error, setError] = useState<{ row: Tapped | null; text: string } | null>(null);
  // The quiet action waiting for its second tap.
  const [armed, setArmed] = useState<"free" | "stop" | null>(null);
  const pickedRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    pickedRef.current?.scrollIntoView({ block: "center" });
  }, []);

  const missing = !!data && !data.quotes;
  useEffect(() => {
    if (missing) console.error("[premier] business-web-get-premier: no quotes", { place_id: placeId });
  }, [missing, placeId]);

  if (!data) {
    return (
      <Card>
        <p className="font-semibold">Premier didn&apos;t load.</p>
        <p className="text-muted-foreground mt-1 text-sm">{loadError}</p>
      </Card>
    );
  }

  const quotes = data.quotes;
  const payer = data.viewer === "payer";
  const home = premierHref(placeId);
  const onRank = data.paid?.tier ?? 0;
  // A guest pays this place's plan; the place may stop it (MESITA-3103).
  const guestPays = !!data.paid && !data.paid.by_you;
  const level = LEVELS[shownLevel(data)];
  const outcome = data.outcome ? OUTCOME[data.outcome] : null;
  const upgrade = data.manual && data.manual.tier > 0 ? data.manual : null;
  const anyBusy = busy !== null;

  async function reload() {
    const r = await getPremier(placeId);
    if (r.ok) setData(r.data);
    else {
      console.error("[premier] business-web-get-premier failed", { place_id: placeId, code: r.code ?? null });
      setError({ row: null, text: r.error });
    }
    router.replace(home);
    router.refresh();
  }

  async function choose(tier: BoostTier) {
    setBusy(tier);
    setError(null);
    const r = await startPremier({ placeId, tier, interval: "year", returnUrl: returnUrl(home) });
    if (!r.ok) {
      setBusy(null);
      return setError({ row: tier, text: `${(r.code && REFUSED[r.code]) || r.error} Nothing was charged. Tap again.` });
    }
    // Stay busy while the browser leaves for Stripe Checkout.
    if (r.data.url) return window.location.assign(r.data.url);
    setBusy(null);
    await reload();
  }

  // Choosing Free is stopping your own renewal (`asPlace` false); Stop it is
  // the place stopping a guest's (`asPlace` true). The paid days run out.
  async function stop(row: "free" | "stop") {
    setBusy(row);
    setError(null);
    setArmed(null);
    const r = await cancelPremier(placeId, row === "stop");
    setBusy(null);
    if (!r.ok) return setError({ row, text: `${r.error} Reload to see your current plan before trying again.` });
    await reload();
  }

  const twoTap = (row: "free" | "stop", label: string): Action => ({
    label: armed === row ? "Tap again" : label,
    armed: armed === row,
    quiet: true,
    run: () => (armed === row ? void stop(row) : setArmed(row)),
    onBlur: () => setArmed(null),
  });

  return (
    <div className="flex flex-col gap-3">
      <Card className="@container overflow-hidden p-0 sm:p-0">
        <div className="px-5 py-5 sm:px-6">
          <p className="font-display flex items-center gap-2 text-2xl font-semibold tracking-tight" aria-label={`Level ${level}`}>
            {level} visibility
            {level !== "1X" ? <PremierRosette /> : null}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">{statusLine(data)}</p>
          {outcome ? (
            <p role="status" className="mt-1 text-sm font-semibold">
              {outcome}
            </p>
          ) : null}
        </div>

        <ul id="plans" className="divide-border border-border scroll-mt-6 divide-y border-t">
          {quotes ? (
            <>
              <Row
                name={FREE_PLAN}
                visibility={FREE_VISIBILITY}
                premier={false}
                price={
                  <>
                    <span className="font-semibold tabular-nums">{usd(0)}</span>
                    <span className="text-muted-foreground"> / year</span>
                  </>
                }
                // On a plan someone else pays for, Free is neither current nor theirs to pick.
                word={!data.paid ? "Current" : payer ? `From ${day(data.paid.ends_at)}` : ""}
                action={payer && data.paid?.renews ? twoTap("free", "Switch") : null}
                busy={anyBusy}
                busyLabel={busy === "free" ? "Switching…" : null}
                error={error?.row === "free" ? error.text : null}
                tinted={onRank === 0}
              />
              {PLANS.map((plan) => {
                const q = quotes[plan.key]?.year;
                if (!q) return null;
                const onIt = onRank === plan.rank;
                const current = payer && data.mine?.tier === plan.rank && data.mine?.interval === "year";
                const blocked = q.kind === "blocked" || q.covered;
                // A resume for someone who never paid here is subscribing early,
                // in the last 7 days of an Upgrade (MESITA-3165).
                const resume = data.viewer === "former_payer" ? "Resume" : "Keep";
                const label = q.covered
                  ? "Given by Mesita"
                  : current
                    ? "Current"
                    : q.kind === "buy"
                      ? "Choose"
                      : q.kind === "resume"
                        ? resume
                        : q.kind === "change"
                          ? "Switch"
                          : "Unavailable";
                // The guest-paid plan's row is where the place stops it.
                const stopHere = guestPays && onIt;
                const action: Action | null = stopHere
                  ? twoTap("stop", "Stop it")
                  : current || blocked
                    ? null
                    : { label, run: () => void choose(plan.key), quiet: q.kind === "change" && plan.rank < onRank };
                const rowError = error?.row === plan.key || (stopHere && error?.row === "stop") ? error.text : null;
                return (
                  <Row
                    key={plan.key}
                    name={PLAN_NAME[plan.key]}
                    visibility={PLAN_VISIBILITY[plan.key]}
                    premier
                    price={
                      <>
                        <span className="font-semibold tabular-nums">{usd(q.price_cents)}</span>
                        <span className="text-muted-foreground"> / year</span>
                      </>
                    }
                    note={
                      stopHere && data.paid
                        ? `A guest pays until ${day(data.paid.ends_at)}`
                        : q.charge_cents !== q.price_cents && q.kind !== "blocked"
                          ? `${q.charge_cents > 0 ? `Now ${usd(q.charge_cents)}` : "Nothing now"}${q.renews_at ? ` · from ${day(q.renews_at)}` : ""}`
                          : null
                    }
                    word={label}
                    action={action}
                    busy={anyBusy}
                    busyLabel={
                      stopHere && busy === "stop"
                        ? "Stopping…"
                        : busy === plan.key
                          ? q.kind === "change"
                            ? "Switching…"
                            : "Opening checkout…"
                          : null
                    }
                    error={rowError}
                    tinted={onIt}
                    rowRef={picked === plan.key && action && !stopHere ? pickedRef : undefined}
                  />
                );
              })}
            </>
          ) : (
            <li className="text-muted-foreground px-5 py-4 text-sm sm:px-6">Plans didn&apos;t load. Reload the page.</li>
          )}

          {upgrade ? (
            <Row
              name="Upgrade"
              visibility={LEVELS[Math.min(upgrade.tier, 2)]}
              premier
              price={REFILL_ORIGIN[ORIGIN_OF_SOURCE[upgrade.source ?? ""] ?? "mesita"]}
              word={day(upgrade.ends_at) ? `Until ${day(upgrade.ends_at)}` : ""}
              action={null}
              busy={anyBusy}
            />
          ) : (
            <li className={ROW}>
              <p className="font-semibold @3xl:order-1">Upgrade</p>
              <p className="text-muted-foreground text-right font-medium @3xl:order-5 @3xl:text-center">None</p>
              <p className="text-muted-foreground col-span-2 @3xl:order-2 @3xl:col-span-3">A level for a set time, from Mesita or a guest.</p>
            </li>
          )}
        </ul>
      </Card>

      <p className="text-muted-foreground px-1 text-sm">Visibility is ranking priority on Home and the Map. It doesn&apos;t guarantee more views.</p>
      {error && error.row === null ? (
        <p className="text-destructive px-1 text-sm" aria-live="polite">
          {error.text}
        </p>
      ) : null}
    </div>
  );
}
