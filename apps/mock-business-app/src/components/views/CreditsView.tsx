"use client";

// Credits — cash now for meals later, and who else honours it.
//
// ── IT HAS A SETUP HALF NOW (MESITA-2017) ──────────────────────────────────
//
// Pato, 2026-09-20: credits are sold by CAMPAIGN — "paga $800 y recibe
// $1,000", from a date to a date, up to a cap on the cash raised, with a
// per-guest limit — because the point is financing: a place that needs cash
// sells meals forward. And a sister branch may ACCEPT this place's credits:
// one-way, chosen by the acceptor, with the issuer keeping the cash and the
// debt forever. "Al aceptar créditos de esta sucursal, asumes las redenciones
// hasta liquidar con el emisor."
//
// ── THERE IS STILL NO GRAND TOTAL, AND THERE MUST NOT BE ───────────────────
//
// The balances list is PAGINATED and the endpoint returns no aggregate. A
// `reduce()` over the page on screen would print "money our guests are
// holding" and mean "money the first twenty-five guests are holding" —
// confidently wrong, on the one screen where being wrong about a number is a
// liability. The exposure tiles count what this page can DEFEND.
//
// ── SETUP STANDARD (MESITA-2034) ────────────────────────────────────────────
//
// `ProductPane` gates Locked upstream (D12A); this file no longer checks
// `planAtLeast`. Two Groups: Campaigns (a `Table` with `inCard`, "New
// campaign" moves into the empty row when there are none), Credits from
// other branches (one Switch row per sister, or one empty row), footer = the
// debt sentence.
import { useState } from "react";
import { useHeldPlace } from "@/components/console/PlaceScope";
import { useMock } from "@/mock/MockStore";
import { Group } from "@/components/shared/Group";
import { Rule } from "@/components/shared/Rule";
import { Table, type Column } from "@/components/shared/Table";
import { Tiles } from "@/components/shared/Tiles";
import { EmptyState } from "@/components/shared/EmptyState";
import { Section } from "@/components/shared/Section";
import { Badge } from "@/components/shared/Badges";
import { Half } from "@/components/shared/Half";
import { CREDIT_BALANCES, CREDIT_CAMPAIGNS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import type { CampaignState, MockCreditBalance, MockCreditCampaign } from "@/mock/types";
import { day, money } from "@/lib/format";
import { GHOST_PILL_BUTTON_CLASS, PILL_BUTTON_CLASS } from "@/lib/ui-classes";

const PAGE = 8;

/** Every state a campaign can be in, with the ONE thing to do about it.
 *  `null` verbs are states that only time moves. */
export const CAMPAIGN_STATES: Record<
  CampaignState,
  { label: string; tone: "off" | "soon" | "live" | "neutral"; verb: string | null }
> = {
  draft: { label: "Draft", tone: "off", verb: "Open" },
  scheduled: { label: "Scheduled", tone: "soon", verb: "Change dates" },
  selling: { label: "Selling", tone: "live", verb: "Close early" },
  sold_out: { label: "Sold out", tone: "live", verb: "Raise the cap" },
  closed: { label: "Closed", tone: "neutral", verb: null },
  redeeming: { label: "Redeeming", tone: "neutral", verb: null },
  expired: { label: "Expired", tone: "neutral", verb: "Extend" },
};

export function CreditsView() {
  const place = useHeldPlace();
  const { scenario, world } = useMock();
  const all = listFor(CREDIT_BALANCES.filter((b) => b.placeId === place.id), scenario);
  const campaigns = listFor(CREDIT_CAMPAIGNS.filter((c) => c.placeId === place.id), scenario);
  const [page, setPage] = useState(0);
  const rows = all.slice(page * PAGE, page * PAGE + PAGE);
  const lastPage = Math.max(0, Math.ceil(all.length / PAGE) - 1);
  // SISTERS ONLY. The candidates are the other places this operator holds —
  // the mock's stand-in for "same organisation" — never the pool.
  const sisters = world.places.filter((p) => p.id !== place.id);
  const [accepting, setAccepting] = useState<Set<string>>(new Set(place.acceptedIssuers));
  const raised = campaigns.reduce((n, c) => n + c.soldCents, 0);

  const campaignColumns: Column<MockCreditCampaign>[] = [
    { key: "name", head: "Campaign", cell: (c) => <span className="font-medium">{c.name}</span> },
    { key: "offer", head: "Offer", cell: (c) => <span className="tabular-nums">pay {money(c.payCents)}, get {money(c.getCents)}</span> },
    { key: "sold", head: "Raised", align: "right", cell: (c) => <span className="tabular-nums">{money(c.soldCents)} <span className="text-muted-foreground">of {money(c.capCents)}</span></span> },
    { key: "window", head: "On sale", cell: (c) => <span className="text-muted-foreground">{day(c.startsAt)} – {day(c.endsAt)}</span> },
    { key: "state", head: "State", cell: (c) => <Badge tone={CAMPAIGN_STATES[c.state].tone}>{CAMPAIGN_STATES[c.state].label}</Badge> },
    { key: "verb", head: "", cell: (c) => CAMPAIGN_STATES[c.state].verb ? <button type="button" className={GHOST_PILL_BUTTON_CLASS}>{CAMPAIGN_STATES[c.state].verb}</button> : null },
  ];
  const balanceColumns: Column<MockCreditBalance>[] = [
    { key: "guest", head: "Guest", cell: (b) => <span className="font-medium">{b.guest}</span> },
    { key: "last", head: "Last move", cell: (b) => <span className="text-muted-foreground">{day(b.lastMoveAt)}</span> },
    { key: "balance", head: "Balance", align: "right", cell: (b) => <span className="font-semibold">{money(b.balanceCents)}</span> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Half label="Manage">
        <Group
          title="Campaigns"
          description="A campaign sells a balance at a bonus, for a while, up to a cap. You receive the cash now and owe the meals until they are eaten."
          right={campaigns.length > 0 ? <button type="button" className={PILL_BUTTON_CLASS}>New campaign</button> : undefined}
          footer="Every campaign says the same thing plainly before it opens: you receive X pesos today; in return you owe Y pesos of meals."
        >
          <Table
            columns={campaignColumns}
            rows={campaigns}
            inCard
            empty={
              <EmptyState
                title="No campaign yet"
                hint="Nothing is on sale until you open one. Guests cannot buy a balance here in the meantime."
                action={{ label: "New campaign", onClick: () => {} }}
              />
            }
          />
        </Group>

        <Group
          title="Credits from other branches"
          description="One direction, your choice. Their guests can spend here; they sold the credits, they keep the cash, and they settle with you."
          footer="By accepting a branch's credits you carry its guests' redemptions until it settles with you. The debt to the guest never moves: it stays with the branch that sold the credits."
        >
          {sisters.length === 0 ? (
            <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <p className="font-display text-sm font-semibold tracking-tight">No other branch</p>
              <p className="text-muted-foreground max-w-[42ch] text-[12px] leading-snug">
                This is the only place you hold. A second branch in the same organisation appears here the day it exists.
              </p>
            </div>
          ) : (
            sisters.map((s) => (
              <Rule
                key={s.id}
                label={s.name}
                note={
                  accepting.has(s.id)
                    ? "Accepting. Their guests' credits are honoured here until you switch this off; what they already spent is settled with them."
                    : "Not accepting. Their guests pay the whole bill here."
                }
                control={{
                  kind: "switch",
                  on: accepting.has(s.id),
                  label: `Accept credits from ${s.name}`,
                  onChange: (on) =>
                    setAccepting((prev) => {
                      const next = new Set(prev);
                      if (on) next.add(s.id);
                      else next.delete(s.id);
                      return next;
                    }),
                }}
              />
            ))
          )}
        </Group>
      </Half>

      <Half label="Activity">
        <Tiles
          tiles={[
            { label: "Credits", value: place.credits ? "On" : "Off" },
            { label: "Cash raised", value: campaigns.length ? money(raised) : null, hint: "Across every campaign listed on Setup" },
            {
              label: "Largest balance on this page",
              value: rows.length ? money(Math.max(...rows.map((b) => b.balanceCents))) : null,
            },
            // NOT a total. See the file header.
            { label: "Outstanding total", value: null, hint: "Not available — see below" },
          ]}
        />
        {place.cashbackPaused && (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground" role="status">
            Cashback from Visit Rewards is paused while Credits is off. Balances
            already banked stay redeemable; no new ones are issued.
          </p>
        )}
        <Section
          title="What guests are holding"
          description={`One page at a time.${accepting.size ? ` Some of it was sold by a branch you accept credits from.` : ""}`}
          right={
            <div className="flex gap-1.5">
              <button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className={GHOST_PILL_BUTTON_CLASS}>
                Previous
              </button>
              <button type="button" disabled={page >= lastPage} onClick={() => setPage((p) => Math.min(lastPage, p + 1))} className={GHOST_PILL_BUTTON_CLASS}>
                Next
              </button>
            </div>
          }
        >
          <Table
            columns={balanceColumns}
            rows={rows}
            empty={
              <EmptyState
                title="No balances"
                hint={place.credits ? "Nobody is holding credits for this place yet." : "Credits are off for this place, so none can be sold."}
              />
            }
          />
          <p className="text-muted-foreground mt-3 text-xs">
            There is no outstanding total on this screen, on purpose. This list is
            paginated and the balance endpoint returns no aggregate, so any total
            computed here would be the total of the page you happen to be on —
            which reads as the total of the place. When the number matters, it has
            to come from a source that can count all of them. The same goes for
            what other branches owe you: it is a settlement, not a page.
          </p>
        </Section>
      </Half>
    </div>
  );
}
