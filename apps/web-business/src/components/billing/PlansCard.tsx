"use client";

// The three plans as boxes (MESITA-3173; boxes MESITA-3183), cleaned up in
// MESITA-3632 (Pato: "Make this Design cleaner"): Free · Pro · Max, each the
// same box: name, "2X visibility" in the headline size, the tag it wears,
// the price, one action. Two sizes only (the headline, then text-sm). The
// box of the plan the place pays for (Free when none) has the dark border;
// the status card above says the level it runs at. No "Plan" heading, no
// pill: where a box has no action its slot keeps today's word as quiet text.
// A tapped box shows its own busy label and its own refusal, with one
// recovery sentence. Pro and Max are the boost_2x / boost_5x subscriptions;
// guests see them marked Ad (package law), the boxes carry no Ad pill
// (MESITA-3186). The footnote keeps the claim true: Premier never promises
// views. Plans are yearly only (MESITA-3285); a subscription bought monthly
// before still renews monthly until its payer changes plan or leaves.
//
// Every amount and date is the server's (business-web-get-premier's quotes);
// this file never computes money.

import { PremierRosette } from "@mesita/place-profile";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cancelPremier, getPremier, startPremier, type BoostTier, type PlacePremier } from "@/lib/business-api";
import { premierHref, returnUrl } from "@/lib/routes";
import { FREE_PLAN, FREE_VISIBILITY, PLAN_NAME, PLAN_VISIBILITY } from "@/lib/plans";
import { day } from "@/lib/format";
import { cn } from "@/lib/utils";

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


function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 });
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
  action: { label: string; run: () => void; onBlur?: () => void; armed?: boolean } | null;
  /** The tapped box's own label while its request runs. */
  busyLabel: string | null;
  /** This box's refusal, with its recovery sentence. */
  error: string | null;
};

function Box({ offer: o, busy, boxRef }: { offer: Offer; busy: boolean; boxRef?: React.Ref<HTMLLIElement> }) {
  return (
    <li
      ref={boxRef}
      className={cn(
        "flex flex-col gap-4 rounded-2xl border p-5 text-sm",
        o.picked && o.action ? "bg-muted/60" : "bg-card",
        o.onIt ? "border-foreground" : "border-border",
      )}
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
          className={cn(
            "border-border hover:bg-muted h-11 w-full rounded-full border font-semibold disabled:opacity-50",
            o.action.armed && "text-destructive",
          )}
        >
          {o.busyLabel ?? o.action.label}
        </button>
      ) : (
        <p className="text-muted-foreground flex h-11 items-center justify-center">{o.word}</p>
      )}
      {o.error ? <p className="text-destructive">{o.error}</p> : null}
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
  // The tapped box ("free" or a tier) while its request runs.
  const [busy, setBusy] = useState<BoostTier | "free" | null>(null);
  // A refusal belongs to the box that was tapped; null tier = no box.
  const [error, setError] = useState<{ tier: BoostTier | "free" | null; text: string } | null>(null);
  const [armed, setArmed] = useState(false);
  const pickedRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    pickedRef.current?.scrollIntoView({ block: "center" });
  }, []);

  const missing = !!data && !data.quotes;
  useEffect(() => {
    if (missing) console.error("[premier] business-web-get-premier: no quotes", { place_id: placeId });
  }, [missing, placeId]);

  if (!data) return null;
  if (!data.quotes) {
    return (
      <section id="plans" className="flex scroll-mt-6 flex-col gap-3">
        <p className="text-muted-foreground text-sm">Plans didn&apos;t load. Reload the page.</p>
      </section>
    );
  }
  const quotes = data.quotes;
  const payer = data.viewer === "payer";
  const home = premierHref(placeId);
  const onRank = data.paid?.tier ?? 0;

  async function reload() {
    const r = await getPremier(placeId);
    if (r.ok) setData(r.data);
    else {
      console.error("[premier] business-web-get-premier failed", { place_id: placeId, code: r.code ?? null });
      setError({ tier: null, text: r.error });
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
      return setError({ tier, text: `${(r.code && REFUSED[r.code]) || r.error} Nothing was charged. Tap again.` });
    }
    // Stay busy while the browser leaves for Stripe Checkout.
    if (r.data.url) return window.location.assign(r.data.url);
    setBusy(null);
    await reload();
  }

  // Choosing Free is stopping your own renewal; the paid days run out.
  async function toFree() {
    setBusy("free");
    setError(null);
    setArmed(false);
    const r = await cancelPremier(placeId, false);
    setBusy(null);
    if (!r.ok) return setError({ tier: "free", text: `${r.error} Reload to see your current plan before trying again.` });
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
          ? { label: armed ? "Tap again" : "Switch", armed, run: () => (armed ? void toFree() : setArmed(true)), onBlur: () => setArmed(false) }
          : null,
      busyLabel: busy === "free" ? "Switching…" : null,
      error: error?.tier === "free" ? error.text : null,
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
      busyLabel: busy === plan.key ? (q.kind === "change" ? "Switching…" : "Opening checkout…") : null,
      error: error?.tier === plan.key ? error.text : null,
    });
  }

  return (
    <section id="plans" className="flex scroll-mt-6 flex-col gap-3">
      <ul className="grid gap-4 sm:grid-cols-3">
        {offers.map((o) => (
          <Box key={o.key} offer={o} busy={busy !== null} boxRef={o.picked && o.action ? pickedRef : undefined} />
        ))}
      </ul>
      <p className="text-muted-foreground text-sm">Visibility is ranking priority on Home and the Map. It doesn&apos;t guarantee more views.</p>
      {error && error.tier === null ? <p className="text-destructive text-sm">{error.text}</p> : null}
    </section>
  );
}
