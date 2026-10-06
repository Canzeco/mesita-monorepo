"use client";

// Visits — the container guests arrive through, and the in-person checkout.
//
// ONE PRODUCT SINCE MESITA-1953, AND STILL ONE DIAL. Rewards merged into this
// card — Pato: *"FOR THE MOMENT I WILL MERGE VISIT & REWARDS"* — so the
// catalogue names Member Visits and the second card is gone.
//
// WHAT DID NOT MOVE IS THE STRATEGY. This view carries a DOOR to the dial, not
// the dial: one product's state settable in two places is how two screens start
// disagreeing about which dial is live, which is the whole reason MESITA-1928
// took the rewards box out of here. The door exists because the card was the
// only way in — this rail carries no product rows — so without it the dial's
// address is reachable by typing and by nothing else.
//
// ── THE MANAGE HALF IS A DOOR, ONE ROW (MESITA-2034) ────────────────────────
//
// Pato, on the open pane: *"what to mention or wtf"*, then *"merge"*. The
// product was explained five times before an operator reached anything they
// could change; the Setup standard's Group grammar cuts that to one Group,
// one row, one door. A one-row Group is normally banned (§2), but there is
// nothing else this Setup half owns — the actual dial is `RewardsView.tsx`,
// reached from here.
//
// LOCKED IS GATED BY `ProductPane` NOW (D12A), not here. This view used to be
// mounted under a Locked header with a live door beneath it, because nothing
// in this file ever checked `planAtLeast` — `ProductPane` refuses to render
// this component at all when `card.state === "locked"`, so that bug cannot
// recur by construction.
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useHeldPlace } from "@/components/console/PlaceScope";
import { Group } from "@/components/shared/Group";
import { Section } from "@/components/shared/Section";
import { Half } from "@/components/shared/Half";
import { Rule } from "@/components/shared/Rule";
import { Table, type Column } from "@/components/shared/Table";
import { Tiles } from "@/components/shared/Tiles";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/shared/Badges";
import { VISITS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import type { MockTender, MockVisit } from "@/mock/types";
import { placeTabHref } from "@/lib/place-tabs";
import { dayTime, money } from "@/lib/format";
import { TENDER_LABEL } from "@/lib/tender";

const STATE_TONE: Record<MockVisit["state"], "on" | "soon" | "bad"> = {
  settled: "on",
  open: "soon",
  voided: "bad",
};

/** PAID WITH IS A BREAKDOWN, NOT A TAG. A visit can be settled by several
 *  tenders at once, so this prints one line per tender and they add up to the
 *  total less Credits. Zero tenders is not "unknown" — it is Credits covering
 *  the whole bill, and the Credits column beside this one already says so. */
function PaidWith({ tenders }: { tenders: MockTender[] }) {
  if (tenders.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col items-start gap-1">
      {tenders.map((t, i) => (
        <span key={`${t.method}-${i}`} className="inline-flex items-center gap-1.5">
          <Badge>{TENDER_LABEL[t.method]}</Badge>
          <span className="text-muted-foreground text-[12px] tabular-nums">
            {money(t.amountCents)}
          </span>
        </span>
      ))}
    </div>
  );
}

export function VisitsView() {
  const place = useHeldPlace();
  const { scenario } = useMock();
  const rows = listFor(VISITS.filter((v) => v.placeId === place.id), scenario);

  const settled = rows.filter((v) => v.state === "settled");
  const columns: Column<MockVisit>[] = [
    { key: "guest", head: "Guest", cell: (v) => <span className="font-medium">{v.guest}</span> },
    { key: "at", head: "When", cell: (v) => <span className="text-muted-foreground">{dayTime(v.at)}</span> },
    // THE TWO REDUCTIONS SIT TOGETHER, then what was actually taken. Credits
    // is not a way to pay — it comes off the bill exactly as the reward does —
    // so it belongs beside Reward and never inside Paid with.
    { key: "reward", head: "Reward", align: "right", cell: (v) => (v.rewardCents ? money(v.rewardCents) : "—") },
    { key: "credits", head: "Credits", align: "right", cell: (v) => (v.creditsCents ? money(v.creditsCents) : "—") },
    { key: "tenders", head: "Paid with", cell: (v) => <PaidWith tenders={v.tenders} /> },
    { key: "total", head: "Total", align: "right", cell: (v) => <span className="font-semibold">{money(v.totalCents)}</span> },
    { key: "state", head: "State", cell: (v) => <Badge tone={STATE_TONE[v.state]}>{v.state}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Half label="Activity">
        <Tiles
          tiles={[
            { label: "Visits shown", value: rows.length || null },
            { label: "Settled", value: settled.length || null },
            {
              label: "Settled total",
              // A sum OF THE ROWS ON SCREEN, labelled as such. The moment a
              // total's scope is not written on it, somebody reads it as the
              // place's revenue.
              value: settled.length ? money(settled.reduce((n, v) => n + v.totalCents, 0)) : null,
              hint: "Of the visits below",
            },
            { label: "Open now", value: rows.filter((v) => v.state === "open").length || null },
          ]}
        />
      </Half>
      <Half label="Manage">
        {/* THE DOOR TO THE DIAL (MESITA-1953). One row, allowed to be alone —
            there is nothing else this Setup half owns; the dial itself is
            RewardsView.tsx, reached from here. */}
        <Group title="What comes back" allowOneRow>
          <Rule
            label={place.visitRewards ? "Rewards are on" : "Rewards are off"}
            note={
              place.visitRewards
                ? "Every settled bill pays out at the rate the strategy sets."
                : "Bills still close and still land on the record — nothing goes back until a strategy is on."
            }
            control={{ kind: "value", text: (
              <Link href={placeTabHref(place.id, "rewards")} className="inline-flex items-center gap-1.5 font-semibold">
                Open Rewards
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ) }}
          />
        </Group>
      </Half>
      <Half label="Activity">
        {/* THE COLUMN IS EXPLAINED WHERE IT IS RENDERED (MESITA-2016). This
            sentence spent its life on the Manage half, inside a "Visit
            checkout" box that had no control in it — so Setup explained a
            table that is not on Setup, and the operator reading `Paid with`
            was one screen away from the only text that says what it means. */}
        <Section
          title="Recent visits"
          description="Newest first. A bill can be settled by more than one tender, so Paid with lists each one — those, plus Credits, add up to the total."
        >
          <Table
            columns={columns}
            rows={rows}
            empty={
              <EmptyState
                title="No visits yet"
                hint="A visit appears the first time a guest closes a bill here with Mesita."
              />
            }
          />
        </Section>
      </Half>
    </div>
  );
}
