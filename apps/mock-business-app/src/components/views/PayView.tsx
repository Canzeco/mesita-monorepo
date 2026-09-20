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
// ── ONE CARD, AND WHY THE REFERENCE IS FOLDED (MESITA-1916) ────────────────
//
// This screen used to be three cards, and it printed the same sentence twice:
// the current state's body rendered once as the summary and again inside a
// five-rung list titled "The ladder", forty words apart, on every state. The
// list was also the tallest thing on the page — four of its five rungs
// describe states this place is NOT in, so a live venue's loudest paragraph
// was "Stripe has paused this account".
//
// So: `lede` is what is true for YOU, now, in the second person. `reference`
// is the third-person definition of the rung, and it lives inside the closed
// disclosure. They are two different strings on purpose — if a future edit
// makes them say the same thing, the bug is back.
//
// The disclosure opens by DEFAULT on the three pre-live states, where the map
// is the point, and stays closed on `enabled` and `restricted`, where it is
// trivia. Its `<ol>` and `aria-current="step"` are the originals, moved
// inside unchanged: collapsing a list must not cost a screen reader the
// announcement, and the card's heading carries the state as text so it is
// heard before the summary either way.
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, RotateCw } from "lucide-react";
import { useHeldPlace } from "@/components/console/PlaceScope";
import { Section } from "@/components/shared/Section";
import { Half } from "@/components/shared/Half";
import { Table, type Column } from "@/components/shared/Table";
import { Tiles } from "@/components/shared/Tiles";
import { EmptyState } from "@/components/shared/EmptyState";
import { FactRow, type Fact } from "@/components/shared/FactRow";
import { PAYOUTS, VISITS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import { dayTime, money } from "@/lib/format";
import { Badge } from "@/components/shared/Badges";
import { PAY_LADDER_LABEL, type MockPayout, type MockVisit, type PayLadder } from "@/mock/types";
import {
  CTA_BUTTON_CLASS,
  ERROR_BOX_CLASS,
  INFO_BOX_CLASS,
  QUIET_LINK_BUTTON_CLASS,
  SECTION_TITLE_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

type PayState = {
  id: PayLadder;
  /** The card's heading. It carries the state in TEXT — the pill beside it is
   *  a second telling for the eye, never the only one. */
  headline: string;
  tone: "neutral" | "soon" | "on" | "bad";
  /** Second person, present tense: what is true for this place right now. */
  lede: string;
  /** Third person: what this rung MEANS. Lives in the disclosure, and must
   *  never be `lede` — that duplication is what this rewrite deleted. */
  reference: string;
  /** Each state names its own facts. A fixed column set nulled out per state
   *  is how you get a label over a blank cell. */
  facts: Fact[];
  verb: string | null;
  dashboard: boolean;
  /** `restricted` only: an account that WAS taking money has stopped, today.
   *  A band inside the card, not a badge on the rail — the rail is shared law
   *  across nine rows and both consoles. */
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

/** The three rungs where an owner is still on their way in. The reference is
 *  a map for them and trivia for everyone else, so it is open here and closed
 *  on the two ends. */
const PRE_LIVE: ReadonlySet<PayLadder> = new Set(["never", "started", "pending"]);

const ENABLED_AT = STATES.findIndex((s) => s.id === "enabled");

/** On the way in, the disclosure is a ROUTE and says "what comes next", so it
 *  runs from here to `enabled` and stops. `restricted` is not next: it is what
 *  can happen to an account that already works, and putting it at the end of a
 *  route reads as a destination. Once live, the disclosure is a glossary and
 *  shows every rung. */
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

  // RE-CHECK HAS TO SAY SOMETHING WHEN THE ANSWER IS "NOTHING". Asking Stripe
  // and getting no change back re-renders an identical screen, so the honest
  // read is "the button did nothing" — the same failure MESITA-1645 fixed for
  // errors, in the one case where nothing went wrong. There is no backend
  // here, so the mock performs the wait; the point is the shape of the
  // feedback, not the fetch.
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

  return (
    <div className="flex flex-col gap-4">
      <Half label="Manage">
      {/* STRIPE'S STORED RETURN. The link's `return_url` was written when the
          link was minted, so an owner can arrive here from a page they opened
          weeks ago. Saying nothing would leave them wondering whether the eight
          minutes they just spent counted. */}
      {returned && (
        <div className={INFO_BOX_CLASS} role="status">
          You came back from Stripe. What it told us is below — if it still says
          unfinished, Stripe is usually a minute behind.
        </div>
      )}

      <Section
        title={
          <>
            {state.headline}
            <Badge tone={state.tone}>{PAY_LADDER_LABEL[state.id]}</Badge>
          </>
        }
        titleClassName={cn(
          SECTION_TITLE_CLASS,
          "flex flex-wrap items-center gap-x-3 gap-y-1.5",
        )}
      >
        {state.alert && (
          <p
            className={cn(
              ERROR_BOX_CLASS,
              "-mt-0.5 px-3.5 py-2.5 text-[13px] leading-relaxed",
            )}
          >
            {state.alert}
          </p>
        )}

        <p className="max-w-[68ch] text-sm leading-relaxed">{state.lede}</p>

        <FactRow facts={state.facts} />

        <div className="mt-1 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
          {state.verb && (
            <button type="button" className={cn(CTA_BUTTON_CLASS, "w-full justify-center sm:w-auto")}>
              {state.verb}
            </button>
          )}
          {state.dashboard && (
            <button type="button" className={cn(CTA_BUTTON_CLASS, "w-full justify-center sm:w-auto")}>
              Open Stripe dashboard
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </button>
          )}
          {/* Nothing to re-check before an account exists. */}
          {state.id !== "never" && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <button
                type="button"
                onClick={recheck}
                disabled={checking}
                className={QUIET_LINK_BUTTON_CLASS}
              >
                <RotateCw
                  className={cn("h-3.5 w-3.5", checking && "animate-spin")}
                  aria-hidden
                />
                {checking ? "Checking…" : "Re-check with Stripe"}
              </button>
              {checked && !checking && (
                <span
                  role="status"
                  className="text-muted-foreground text-[12px] leading-relaxed"
                >
                  Checked just now — nothing has changed yet.
                </span>
              )}
            </div>
          )}
          {/* NOT A DISABLED BUTTON. There is no dashboard to open yet, and a
              greyed control says "you may not" where the truth is "it does not
              exist". */}
          {!state.dashboard && (
            <p className="text-muted-foreground text-[12px]">
              The Stripe dashboard appears once the account is on.
            </p>
          )}
        </div>

        <details
          open={preLive}
          className="border-border/70 group mt-1 border-t pt-3"
        >
          <summary className="text-muted-foreground hover:text-foreground marker:content-[''] flex cursor-pointer list-none items-center gap-2 text-[12px] font-medium transition">
            <svg
              viewBox="0 0 24 24"
              className="h-3 w-3 transition-transform duration-200 ease-out group-open:rotate-90"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
            {preLive ? "What comes next" : "What the other states mean"}
          </summary>
          <ol className="mt-3 flex flex-col">
            {referenceRungs(state.id).map((s) => {
              const here = s.id === state.id;
              return (
                <li
                  key={s.id}
                  aria-current={here ? "step" : undefined}
                  // 220px, not 168: the widest label is "Setup unfinished"
                  // and it carries the "you are here" marker, which wrapped
                  // the label onto two lines at the narrower width.
                  className="border-border/60 grid gap-x-5 gap-y-0.5 border-b py-2.5 last:border-b-0 sm:grid-cols-[220px_minmax(0,1fr)]"
                >
                  <p
                    className={cn(
                      TINY_LABEL_CLASS,
                      here && "text-foreground",
                    )}
                  >
                    {PAY_LADDER_LABEL[s.id]}
                    {here && (
                      <span className="text-muted-foreground ml-2 font-medium normal-case tracking-normal">
                        you are here
                      </span>
                    )}
                  </p>
                  <p
                    className={cn(
                      "max-w-[78ch] text-[12.5px] leading-snug",
                      here ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {s.reference}
                  </p>
                </li>
              );
            })}
          </ol>
        </details>
      </Section>
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
