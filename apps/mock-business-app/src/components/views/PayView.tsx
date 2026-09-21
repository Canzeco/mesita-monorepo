"use client";

// Online Payments — this place's own Stripe Connect account.
//
// ── THE ONE THING THIS SCREEN EXISTS TO GET RIGHT ──────────────────────────
//
// Stripe sets `disabled_reason` on an account AT CREATION. A brand-new account
// that nobody has touched and an account Stripe has shut down report the same
// field, so a console that reads "disabled" and says "disabled" tells a venue
// on its first morning that it has been rejected. `STATES` below is ordered so
// the console asks "has onboarding finished?" BEFORE it asks "is anything
// wrong?", and the two ends of that order never wear the same words.
//
// The dashboard link is the other trap: there is no Stripe Express dashboard
// until the account is enabled, so offering one earlier is a link to a 404 at
// the exact moment an owner is least willing to believe the product works.
//
// ── SETUP STANDARD (MESITA-2034) ────────────────────────────────────────────
//
// `ProductPane` gates Locked upstream — this product has none, it is not in
// `PRODUCT_HALVES`'s locked set. Two Groups on the Manage half: Stripe
// account (the state row, the re-check row, the fact rows) and The ladder
// — which renders ONLY on the three pre-live rungs (never/started/pending),
// keeping MESITA-1916's fix: on `enabled`/`restricted` it does not render at
// all, and the Stripe-account Group's footer carries the one glossary line
// instead of an always-open five-rung list.
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { useHeldPlace } from "@/components/console/PlaceScope";
import { Group } from "@/components/shared/Group";
import { Rule } from "@/components/shared/Rule";
import { Notice } from "@/components/shared/Notice";
import { Section } from "@/components/shared/Section";
import { Half } from "@/components/shared/Half";
import { Table, type Column } from "@/components/shared/Table";
import { Tiles } from "@/components/shared/Tiles";
import { EmptyState } from "@/components/shared/EmptyState";
import { PAYOUTS, VISITS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import { dayTime, money } from "@/lib/format";
import { Badge } from "@/components/shared/Badges";
import { PAY_LADDER_LABEL, type MockPayout, type MockVisit, type PayLadder } from "@/mock/types";

type PayState = {
  id: PayLadder;
  /** The card's heading. It carries the state in TEXT — the pill beside it is
   *  a second telling for the eye, never the only one. */
  headline: string;
  tone: "neutral" | "soon" | "on" | "bad";
  /** Second person, present tense: what is true for this place right now. */
  lede: string;
  /** Third person: what this rung MEANS. Lives in the ladder Group, and must
   *  never be `lede` — that duplication is what an earlier rewrite deleted. */
  reference: string;
  /** Each state names its own facts. A fixed column set nulled out per state
   *  is how you get a label over a blank cell. */
  facts: { k: string; v: string; note?: string }[];
  verb: string | null;
  dashboard: boolean;
  /** `restricted` only: an account that WAS taking money has stopped, today.
   *  A Notice, not a fact buried in the lede. */
  alert?: string;
};

const STATES: PayState[] = [
  {
    id: "never",
    headline: "Payments aren't set up",
    tone: "neutral",
    lede:
      "Nobody can pay this place by card through Mesita yet. The Stripe account belongs to this place alone — Stripe has no account merge, so one account can never be split across two venues later.",
    reference: "No Stripe account for this place yet.",
    facts: [
      { k: "Takes", v: "About 10 minutes" },
      { k: "You'll need", v: "Legal entity, bank account, ID" },
    ],
    verb: "Set up payments",
    dashboard: false,
  },
  {
    id: "started",
    headline: "Stripe still needs something",
    tone: "soon",
    lede:
      "You started the account and Stripe is still missing a few answers. Picking up where you left off does not restart anything you already sent.",
    reference:
      "Stripe has the account and is still waiting on part of what it asked for.",
    facts: [
      { k: "Stripe still needs", v: "3 items" },
      { k: "Country", v: "Mexico", note: "permanent" },
    ],
    verb: "Finish setup",
    dashboard: false,
  },
  {
    id: "pending",
    headline: "Stripe is reviewing this account",
    tone: "soon",
    lede:
      "Everything is submitted. There is nothing to do until Stripe answers, and a second submission does not make it faster.",
    reference: "Everything is submitted and Stripe is checking it.",
    facts: [
      { k: "Submitted", v: "2 days ago" },
      { k: "Usually answers", v: "Within a day" },
    ],
    verb: null,
    dashboard: false,
  },
  {
    id: "enabled",
    headline: "Payments are on",
    tone: "on",
    lede:
      "Guests can pay by card on visits and orders. The money goes straight to this place's Stripe account, on Stripe's schedule — Mesita never holds it.",
    reference: "Charges and payouts are live.",
    facts: [
      { k: "Payouts", v: "On your Stripe schedule" },
      { k: "Country", v: "Mexico" },
      { k: "Disputes", v: "Handled by Stripe", note: "shown there first" },
    ],
    verb: null,
    dashboard: true,
  },
  {
    id: "restricted",
    headline: "Stripe has paused this account",
    tone: "bad",
    alert:
      "Stripe wants something specific before it will take card payments again. Its dashboard says what — nothing on Mesita's side can clear it.",
    lede:
      "Card payments are off until Stripe is satisfied. Money that already paid out is not affected.",
    reference: "Stripe paused the account after it had been working.",
    facts: [
      { k: "Why", v: "Stripe needs more information" },
      { k: "Who can fix it", v: "You, on Stripe's dashboard" },
    ],
    // No `verb`. This rung used to offer "Open Stripe" AND the dashboard
    // button — two controls, one destination, on the state with the least
    // patience for a decision. The dashboard IS the action here.
    verb: null,
    dashboard: true,
  },
];

/** The three rungs where an owner is still on their way in. The ladder is a
 *  ROUTE for them ("what comes next") and does not render at all for the two
 *  ends (MESITA-1916's fix, kept). */
const PRE_LIVE: ReadonlySet<PayLadder> = new Set(["never", "started", "pending"]);

const ENABLED_AT = STATES.findIndex((s) => s.id === "enabled");

/** On the way in, the ladder runs from here to `enabled` and stops.
 *  `restricted` is not "next": it is what can happen to an account that
 *  already works, and putting it at the end of a route reads as a
 *  destination. */
function referenceRungs(current: PayLadder): PayState[] {
  if (!PRE_LIVE.has(current)) return STATES;
  return STATES.slice(
    STATES.findIndex((s) => s.id === current),
    ENABLED_AT + 1,
  );
}

/** MESITA'S FEE, BY WHAT WAS PAID FOR (MESITA-2017). Not a setting: Pato,
 *  2026-09-20 — *"cobra según el tipo de orden, si es visita cobro menos, si
 *  es online order cobro una tarifa del 10%"*. Mesita charges ONLY when it
 *  processes the digital payment; cash costs the place nothing and a
 *  marketplace order pays the marketplace, not Mesita. Basis points. */
export const FEE_BPS = { visit: 300, order: 1000 } as const;

export function PayView() {
  const place = useHeldPlace();
  const { scenario } = useMock();
  // A CHARGE is a visit a guest paid through Mesita. Cash and card at the
  // till are not charges: nothing was processed, so nothing was charged.
  const charges = listFor(
    VISITS.filter((v) => v.placeId === place.id && v.tenders.some((t) => t.method === "mesita_pay")),
    scenario,
  );
  const payouts = listFor(PAYOUTS.filter((p) => p.placeId === place.id), scenario);
  const feeOf = (v: MockVisit) =>
    Math.round((v.tenders.find((t) => t.method === "mesita_pay")?.amountCents ?? 0) * FEE_BPS.visit / 10_000);
  const chargeColumns: Column<MockVisit>[] = [
    { key: "guest", head: "Guest", cell: (v) => <span className="font-medium">{v.guest}</span> },
    { key: "at", head: "When", cell: (v) => <span className="text-muted-foreground">{dayTime(v.at)}</span> },
    { key: "charged", head: "Charged", align: "right", cell: (v) => <span className="tabular-nums">{money(v.tenders.find((t) => t.method === "mesita_pay")?.amountCents ?? 0)}</span> },
    { key: "fee", head: "Mesita's fee", align: "right", cell: (v) => <span className="text-muted-foreground tabular-nums">{money(feeOf(v))}</span> },
    { key: "net", head: "To you", align: "right", cell: (v) => <span className="font-semibold tabular-nums">{money((v.tenders.find((t) => t.method === "mesita_pay")?.amountCents ?? 0) - feeOf(v))}</span> },
  ];
  const payoutColumns: Column<MockPayout>[] = [
    { key: "at", head: "When", cell: (p) => <span className="text-muted-foreground">{dayTime(p.at)}</span> },
    { key: "to", head: "To", cell: (p) => <span className="tabular-nums">···{p.last4}</span> },
    { key: "amount", head: "Amount", align: "right", cell: (p) => <span className="font-semibold tabular-nums">{money(p.amountCents)}</span> },
    { key: "state", head: "State", cell: (p) => <Badge tone={p.state === "paid" ? "live" : "soon"}>{p.state === "paid" ? "Paid" : "In transit"}</Badge> },
  ];
  const search = useSearchParams();
  const returned = search.get("connect");
  const state = STATES.find((s) => s.id === place.pay)!;
  const preLive = PRE_LIVE.has(state.id);

  // RE-CHECK HAS TO SAY SOMETHING WHEN THE ANSWER IS "NOTHING" (§7 Success).
  // Asking Stripe and getting no change back re-renders an identical badge,
  // so the honest read is a role=status NOTE, not a badge that looks the
  // same before and after a click — the same failure MESITA-1645 fixed for
  // errors, in the one case where nothing went wrong.
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const recheck = () => {
    if (checking) return;
    setChecking(true);
    setChecked(false);
    timer.current = setTimeout(() => {
      setChecking(false);
      setChecked(true);
    }, 900);
  };

  const badgeTone = state.tone === "on" ? "live" : state.tone === "bad" ? "bad" : state.tone === "soon" ? "soon" : "neutral";

  return (
    <div className="flex flex-col gap-4">
      <Half label="Manage">
        {/* PRIORITY 0: a failing account outranks the returned-from-Stripe
            door (§7 Notice ordering). */}
        <Notice
          show={state.id === "restricted"}
          tone="bad"
          icon={<ArrowUpRight className="h-4 w-4" aria-hidden />}
          title="Stripe needs your attention"
          note={state.alert}
        />
        {/* STRIPE'S STORED RETURN. The link's `return_url` was written when
            the link was minted, so an owner can arrive here from a page they
            opened weeks ago. Saying nothing would leave them wondering
            whether the eight minutes they just spent counted. */}
        <Notice
          show={Boolean(returned) && state.id !== "restricted"}
          icon={<ArrowUpRight className="h-4 w-4" aria-hidden />}
          title="You came back from Stripe"
          note="What it told us is below — if it still says unfinished, Stripe is usually a minute behind."
        />

        <Group
          title="Stripe account"
          footer={!preLive ? "Every other state Stripe can be in is explained on its dashboard." : undefined}
        >
          <Rule
            label={state.headline}
            note={state.lede}
            badge={<Badge tone={badgeTone}>{PAY_LADDER_LABEL[state.id]}</Badge>}
            control={
              state.verb
                ? { kind: "button", label: state.verb, emphasis: "primary", onClick: () => {} }
                : state.dashboard
                  ? { kind: "button", label: "Open Stripe dashboard", onClick: () => {} }
                  : undefined
            }
          />
          {state.id !== "never" && (
            <Rule
              label="Stripe's answer"
              note={
                checked && !checking
                  ? "Checked just now — nothing has changed yet."
                  : !state.dashboard
                    ? "The Stripe dashboard appears once the account is on."
                    : undefined
              }
              control={{
                kind: "button",
                label: checking ? "Checking…" : "Re-check with Stripe",
                disabled: checking,
                onClick: recheck,
              }}
            />
          )}
          {state.facts.map((f) => (
            <Rule key={f.k} label={f.k} note={f.note} control={{ kind: "value", text: f.v }} />
          ))}
        </Group>

        {/* THE LADDER — ONLY ON THE THREE PRE-LIVE RUNGS (MESITA-1916, kept).
            On `enabled`/`restricted` this Group does not render at all; the
            Stripe-account Group's footer above carries the one glossary line
            instead of an always-open five-rung list. */}
        {preLive && (
          <Group title="What comes next">
            {referenceRungs(state.id).map((s) => {
              const here = s.id === state.id;
              return (
                <Rule
                  key={s.id}
                  label={here ? `${PAY_LADDER_LABEL[s.id]} — you are here` : PAY_LADDER_LABEL[s.id]}
                  note={s.reference}
                  control={here ? { kind: "value", text: <Badge tone="on">Now</Badge> } : undefined}
                />
              );
            })}
          </Group>
        )}
      </Half>

      {/* THE EVENT CONSOLE (MESITA-2017). Express keeps identity, the bank
          account and disputes; what Mesita may show is what it processed and
          what it kept. THE FEE IS PRINTED PER CHARGE, not hidden in a net —
          Pato's rule is that a place pays only when Mesita processes the
          payment, and a fee you cannot see is a fee you argue about. */}
      <Half label="Activity">
        <Tiles
          tiles={[
            { label: "Charges", value: charges.length || null, hint: "Paid through Mesita, listed below" },
            { label: "Mesita's fee", value: charges.length ? money(charges.reduce((n, v) => n + feeOf(v), 0)) : null, hint: `${FEE_BPS.visit / 100}% of a visit, ${FEE_BPS.order / 100}% of an order` },
            { label: "Payouts", value: payouts.length || null, hint: "On Stripe's schedule" },
          ]}
        />
        <Section title="Charges" description="Every payment Mesita processed for this place, newest first. Cash and card at the till are not here: nothing was charged for them.">
          <Table
            columns={chargeColumns}
            rows={charges}
            empty={<EmptyState title="No charges yet" hint={state.id === "enabled" ? "A charge appears the moment a guest pays through Mesita." : "Payments are not on, so nothing can be charged."} />}
          />
        </Section>
        <Section title="Payouts" description="What Stripe sent to your account. Disputes and refunds are on Stripe's dashboard first.">
          <Table columns={payoutColumns} rows={payouts} empty={<EmptyState title="No payouts yet" hint="Stripe pays out on its own schedule once there is something to pay." />} />
        </Section>
      </Half>
    </div>
  );
}
