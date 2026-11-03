"use client";

// The three plans (MESITA-3173, Pato: "you actually buy access to all the
// software, don't separate premier"): Free · Pro · Max, Premier 1X · 2X · 5X
// (MESITA-3174). Pro and Max are the boost_2x / boost_5x subscriptions and
// carry Premier 2X / 5X ranking, so the paid plans keep the Ad tag (package
// law). Billing draws them as one card of rows; Premier as three boxes, like
// a subscription page (MESITA-3183). Both buy, and come back where they began.
//
// Every amount and date is the server's (business-web-get-premier's quotes);
// this file never computes money.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cancelPremier, getPremier, startPremier, type BoostInterval, type BoostTier, type PlacePremier } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { billingHref, returnUrl } from "@/lib/routes";
import { FREE_LEVEL, FREE_PLAN, PLAN_LEVEL, PLAN_NAME } from "@/lib/plans";

const PLANS: Array<{ key: BoostTier; rank: number }> = [
  { key: "boost_2x", rank: 1 },
  { key: "boost_5x", rank: 2 },
];

const REFUSED: Record<string, string> = {
  covered_by_mesita: "Mesita already gives this place that level. Nothing was charged.",
  premier_taken: "A guest already pays for Premier here. Stop their subscription first, then choose a plan.",
  charging: "A renewal is being charged. Try again in a few minutes.",
  not_payer: "Only the person who pays can update the card.",
  lost: "Your plan changed while you were choosing. Look again.",
};

const OUTCOME: Record<string, string> = {
  confirmed: "Your plan is on. Thank you.",
  declined: "The card was declined. Nothing was charged.",
  covered: "Mesita already gives this place that level. Nothing was charged.",
  pending: "Your payment is being confirmed. This page updates in a moment.",
  expired: "That checkout expired. Nothing was charged.",
  lost: "Someone else started a plan first. Nothing was charged.",
};

function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 });
}

function day(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function AdTag() {
  return <span className="border-border text-muted-foreground type-label rounded-full border px-1.5 font-semibold">Ad</span>;
}

/** One plan, whichever way it is drawn. With no `action`, `word` says where
 *  the plan stands. */
type Offer = {
  key: string;
  name: string;
  level: string;
  ad: boolean;
  cents: number;
  note: string | null;
  /** The plan the place is on, whichever interval the toggle shows. */
  onIt: boolean;
  picked: boolean;
  word: string;
  action: { label: string; run: () => void; onBlur?: () => void } | null;
};

// One quiet list (MESITA-3177): name over level, price, one outlined action;
// the current plan is a word, not a button.
const rowClass = "flex items-center gap-4 px-5 py-4 sm:px-6";
const actionClass = "border-border hover:bg-muted h-9 w-24 shrink-0 rounded-full border text-sm font-semibold disabled:opacity-50";
const currentClass = "text-muted-foreground w-24 shrink-0 text-center text-sm font-medium";

/** Three boxes side by side (MESITA-3183); one under the other on a phone. */
function Box({ offer: o, interval, busy }: { offer: Offer; interval: BoostInterval; busy: boolean }) {
  return (
    <li className={`bg-card flex flex-col gap-4 rounded-2xl border p-5 ${o.onIt ? "border-foreground ring-foreground ring-1" : "border-border"}`}>
      <div>
        <p className="flex items-center gap-2 font-semibold">
          {o.name}
          {o.ad ? <AdTag /> : null}
        </p>
        <p className="text-muted-foreground text-sm">{o.level}</p>
      </div>
      <div>
        <p>
          <span className="font-display text-3xl font-semibold tracking-tight tabular-nums">{usd(o.cents)}</span>
          <span className="text-muted-foreground text-sm"> / {interval}</span>
        </p>
        {o.note ? <p className="text-muted-foreground mt-1 text-xs">{o.note}</p> : null}
      </div>
      <div className="mt-auto">
        {o.action ? (
          <button
            type="button"
            disabled={busy}
            onClick={o.action.run}
            onBlur={o.action.onBlur}
            className="border-border hover:bg-muted h-10 w-full rounded-full border text-sm font-semibold disabled:opacity-50"
          >
            {o.action.label}
          </button>
        ) : (
          <p className="text-muted-foreground flex h-10 items-center justify-center text-sm font-medium">{o.word}</p>
        )}
      </div>
    </li>
  );
}

export function PlansCard({
  placeId,
  initial,
  picked = null,
  layout = "rows",
  backTo,
}: {
  placeId: string;
  initial: PlacePremier | null;
  /** A plan Billing's Keep button picked. */
  picked?: BoostTier | null;
  /** Billing's card of rows, or Premier's three boxes. */
  layout?: "rows" | "boxes";
  /** The page Checkout returns to and a change reloads; Billing by default. */
  backTo?: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<PlacePremier | null>(initial);
  const [interval, setBillingInterval] = useState<BoostInterval>(picked ? "month" : (initial?.mine?.interval ?? "month"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const pickedRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    pickedRef.current?.scrollIntoView({ block: "center" });
  }, []);

  if (!data?.quotes) return null;
  const quotes = data.quotes;
  const payer = data.viewer === "payer";
  const notice = data.outcome && OUTCOME[data.outcome] ? OUTCOME[data.outcome] : null;
  const home = backTo ?? billingHref(placeId);
  const onRank = data.paid?.tier ?? 0;

  async function reload() {
    const r = await getPremier(placeId);
    if (r.ok) setData(r.data);
    else setError(r.error);
    router.replace(home);
    router.refresh();
  }

  async function choose(tier: BoostTier) {
    setBusy(true);
    setError(null);
    const r = await startPremier({ placeId, tier, interval, returnUrl: returnUrl(home) });
    setBusy(false);
    if (!r.ok) return setError((r.code && REFUSED[r.code]) || r.error);
    if (r.data.url) return window.location.assign(r.data.url);
    await reload();
  }

  // Choosing Free is stopping your own renewal; the paid days run out.
  async function toFree() {
    setBusy(true);
    setError(null);
    setArmed(false);
    const r = await cancelPremier(placeId, false);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    await reload();
  }

  const offers: Offer[] = [
    {
      key: "free",
      name: FREE_PLAN,
      level: FREE_LEVEL,
      ad: false,
      cents: 0,
      note: null,
      onIt: onRank === 0,
      picked: false,
      // On a plan someone else pays for, Free is neither current nor theirs to pick.
      word: !data.paid ? "Current" : payer ? `From ${day(data.paid.ends_at)}` : "",
      action:
        payer && data.paid?.renews
          ? { label: armed ? "Tap again" : "Switch", run: () => (armed ? void toFree() : setArmed(true)), onBlur: () => setArmed(false) }
          : null,
    },
  ];
  for (const plan of PLANS) {
    const q = quotes[plan.key]?.[interval];
    if (!q) continue;
    const current = payer && data.mine?.tier === plan.rank && data.mine?.interval === interval;
    const blocked = q.kind === "blocked" || q.covered;
    // A resume for someone who never paid here is subscribing early, in the
    // last 7 days of a Boost (MESITA-3165).
    const resume = data.viewer === "former_payer" ? "Resume" : "Keep";
    const label =
      q.covered ? "Given by Mesita" : current ? "Current" : q.kind === "buy" ? "Choose" : q.kind === "resume" ? resume : q.kind === "change" ? "Switch" : "Unavailable";
    offers.push({
      key: plan.key,
      name: PLAN_NAME[plan.key],
      level: PLAN_LEVEL[plan.key],
      ad: true,
      cents: q.price_cents,
      note:
        q.charge_cents !== q.price_cents && q.kind !== "blocked"
          ? `${q.charge_cents > 0 ? `Now ${usd(q.charge_cents)}` : "Nothing now"}${q.renews_at ? ` · from ${day(q.renews_at)}` : ""}`
          : null,
      onIt: onRank === plan.rank,
      picked: picked === plan.key,
      word: label,
      action: current || blocked ? null : { label, run: () => void choose(plan.key) },
    });
  }

  const toggle = (
    <div className="bg-muted inline-flex rounded-full p-1 text-sm" role="radiogroup" aria-label="Billing">
      {(["month", "year"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={interval === v}
          onClick={() => setBillingInterval(v)}
          className={"rounded-full px-3 py-1 font-medium " + (interval === v ? "bg-card shadow-sm" : "text-muted-foreground")}
        >
          {v === "month" ? "Monthly" : "Yearly"}
        </button>
      ))}
    </div>
  );

  if (layout === "boxes") {
    return (
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Plan</h2>
          {toggle}
        </div>
        {notice ? <p className="text-sm">{notice}</p> : null}
        <ul className="grid gap-4 sm:grid-cols-3">
          {offers.map((o) => (
            <Box key={o.key} offer={o} interval={interval} busy={busy} />
          ))}
        </ul>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </section>
    );
  }

  return (
    <Card className="flex scroll-mt-6 flex-col p-0 sm:p-0">
      <div id="plans" className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
        <h2 className="font-semibold">Plans</h2>
        {toggle}
      </div>
      {notice ? <p className="border-border border-t px-5 py-3 text-sm sm:px-6">{notice}</p> : null}
      <ul className="divide-border border-border divide-y border-t">
        {offers.map((o) => (
          <li key={o.key} ref={o.picked ? pickedRef : undefined} className={`${rowClass} ${o.picked ? "bg-muted/60" : ""}`}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{o.name}</p>
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                {o.level}
                {o.ad ? <AdTag /> : null}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm">
                <span className="font-semibold tabular-nums">{usd(o.cents)}</span>
                <span className="text-muted-foreground"> / {interval}</span>
              </p>
              {o.note ? <p className="text-muted-foreground text-xs">{o.note}</p> : null}
            </div>
            {o.action ? (
              <button type="button" disabled={busy} onClick={o.action.run} onBlur={o.action.onBlur} className={actionClass}>
                {o.action.label}
              </button>
            ) : (
              <span className={currentClass}>{o.word}</span>
            )}
          </li>
        ))}
      </ul>
      {error ? <p className="text-destructive border-border border-t px-5 py-3 text-sm sm:px-6">{error}</p> : null}
    </Card>
  );
}
