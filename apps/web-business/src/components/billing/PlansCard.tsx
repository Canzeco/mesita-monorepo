"use client";

// The three plans as boxes (MESITA-3173, Pato: "you actually buy access to all
// the software, don't separate premier"; boxes MESITA-3183): Free · Pro · Max.
// They live on Premier (Billing folded in, MESITA-3620). Visibility is the one perk, so it is
// each box's anchor (Pato: "make the visibility most notorious"): 1X · 2X · 5X,
// then the tag it wears, the price, one action. Two sizes only (Pato: "don't use
// lots of different sizes"): that headline, the rest body. Pro and Max are the boost_2x /
// boost_5x subscriptions; guests see them marked Ad (package law), the boxes
// carry no Ad pill (Pato, MESITA-3186: "remove ad icon there"). The small print
// keeps the claim true: Premier never promises views.
//
// Plans are yearly only (MESITA-3285: Pro $99, Max $999 a year), so there is no
// Monthly/Yearly toggle; a subscription bought monthly before still renews
// monthly until its payer changes plan or leaves.
//
// Every amount and date is the server's (business-web-get-premier's quotes);
// this file never computes money.

import { PremierRosette } from "@mesita/place-profile";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cancelPremier, getPremier, startPremier, type BoostTier, type PlacePremier } from "@/lib/business-api";
import { premierHref, returnUrl } from "@/lib/routes";
import { FREE_PLAN, FREE_VISIBILITY, PLAN_NAME, PLAN_VISIBILITY } from "@/lib/plans";

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
  interval_retired: "Plans are yearly only now. Reload the page and choose again.",
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

/** One plan. With no `action`, `word` says where the plan stands. */
type Offer = {
  key: string;
  name: string;
  visibility: string;
  /** Paid: the red Premier mark. */
  premier: boolean;
  cents: number;
  note: string | null;
  /** The plan the place is on. */
  onIt: boolean;
  picked: boolean;
  word: string;
  action: { label: string; run: () => void; onBlur?: () => void } | null;
};

function Box({ offer: o, busy, boxRef }: { offer: Offer; busy: boolean; boxRef?: React.Ref<HTMLLIElement> }) {
  return (
    <li
      ref={boxRef}
      className={`flex flex-col gap-4 rounded-2xl border p-5 ${o.picked ? "bg-muted/60" : "bg-card"} ${o.onIt ? "border-foreground ring-foreground ring-1" : "border-border"}`}
    >
      <p className="font-semibold">{o.name}</p>
      <div>
        <p className="font-display text-2xl font-semibold tracking-tight">{o.visibility} visibility</p>
        {o.premier ? (
          <p className="mt-1 flex items-center gap-1.5">
            <PremierRosette />
            Premier red tag
          </p>
        ) : (
          <p className="text-muted-foreground mt-1 flex min-h-6 items-center">No Premier tag</p>
        )}
      </div>
      <div className="border-border mt-auto border-t pt-4">
        <p>
          <span className="font-semibold tabular-nums">{usd(o.cents)}</span>
          <span className="text-muted-foreground"> / year</span>
        </p>
        {o.note ? <p className="text-muted-foreground">{o.note}</p> : null}
      </div>
      {o.action ? (
        <button
          type="button"
          disabled={busy}
          onClick={o.action.run}
          onBlur={o.action.onBlur}
          className="border-border hover:bg-muted h-11 w-full rounded-full border font-semibold disabled:opacity-50"
        >
          {o.action.label}
        </button>
      ) : (
        <p className="text-muted-foreground flex h-11 items-center justify-center font-medium">{o.word}</p>
      )}
    </li>
  );
}

export function PlansCard({
  placeId,
  initial,
  picked = null,
}: {
  placeId: string;
  initial: PlacePremier | null;
  /** A plan picked by `?plan=` (Keep links). */
  picked?: BoostTier | null;
}) {
  const router = useRouter();
  const [data, setData] = useState<PlacePremier | null>(initial);
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
  const home = premierHref(placeId);
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
    const r = await startPremier({ placeId, tier, interval: "year", returnUrl: returnUrl(home) });
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
      visibility: FREE_VISIBILITY,
      premier: false,
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
    const q = quotes[plan.key]?.year;
    if (!q) continue;
    const current = payer && data.mine?.tier === plan.rank && data.mine?.interval === "year";
    const blocked = q.kind === "blocked" || q.covered;
    // A resume for someone who never paid here is subscribing early, in the
    // last 7 days of an Upgrade (MESITA-3165).
    const resume = data.viewer === "former_payer" ? "Resume" : "Keep";
    const label =
      q.covered ? "Given by Mesita" : current ? "Current" : q.kind === "buy" ? "Choose" : q.kind === "resume" ? resume : q.kind === "change" ? "Switch" : "Unavailable";
    offers.push({
      key: plan.key,
      name: PLAN_NAME[plan.key],
      visibility: PLAN_VISIBILITY[plan.key],
      premier: true,
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

  return (
    <section id="plans" className="flex scroll-mt-6 flex-col gap-3">
      <h2 className="font-semibold">Plan</h2>
      {notice ? <p className="text-sm">{notice}</p> : null}
      <ul className="grid gap-4 sm:grid-cols-3">
        {offers.map((o) => (
          <Box key={o.key} offer={o} busy={busy} boxRef={o.picked ? pickedRef : undefined} />
        ))}
      </ul>
      <p className="text-muted-foreground text-sm">Visibility is ranking priority on Home and the Map. It doesn&apos;t guarantee more views.</p>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </section>
  );
}
