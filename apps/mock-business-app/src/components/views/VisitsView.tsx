"use client";

// Visits — the container guests arrive through, and the in-person checkout.
//
// ONE PRODUCT SINCE MESITA-1953, AND STILL ONE DIAL. Rewards merged into this
// card — Pato: *"FOR THE MOMENT I WILL MERGE VISIT & REWARDS"* — so the
// catalogue names Visit Rewards and the second card is gone.
//
// WHAT DID NOT MOVE IS THE STRATEGY. This view carries a DOOR to the dial, not
// the dial: one product's state settable in two places is how two screens start
// disagreeing about which dial is live, which is the whole reason MESITA-1928
// took the rewards box out of here. The door exists because the card was the
// only way in — this rail carries no product rows — so without it the dial's
// address is reachable by typing and by nothing else.
//
// ── THE MANAGE HALF SAYS HOW IT IS SET, NOT WHAT IT DOES (MESITA-2016) ─────
//
// Pato, on the open pane: *"what to mention or wtf"*, then *"merge"*. Setup →
// Visit Rewards was 400 words and no setting. The product was explained FIVE
// times before the operator reached anything they could change: the blurb, the
// note, the "Visit checkout" description, its paragraph, and "What comes back"
// twice over — the last three being one sentence at three font sizes. A sixth
// copy lives in `product-catalog.ts` and a seventh in the grid row.
//
// Docs › Apps already carried the law this violates: when Products became
// Setup, *"Off says what a product does, On says how it is set"*. Visit
// Rewards is On here and the pane read like a brochure.
//
// SO THE FOUR SURFACES STOP OVERLAPPING. The grid row's `blurb` is one
// sentence to tell this product from its neighbour; `PRODUCT_CATALOG_COPY` is
// the paragraph that sells it, read once while deciding; the Manage half is
// what you can CHANGE — a control, or one honest door to it; the Activity half
// is what the product did, and what its own columns mean.
//
// Inside a Manage `Section` that splits in two: the `description` says what you
// can do, the body says the CURRENT STATE. Neither re-explains the product.
//
// "Visit checkout" is gone because it failed that test completely — no state,
// no setting, and an inert *How it works* button for its only affordance. It
// was catalogue copy that took up residence on an operating screen, where the
// owner who has run this for six months reads the tutorial every time. Its one
// load-bearing fact — multi-tender settlement, and what `Paid with` means —
// MOVED rather than died: it is the Activity half's table description now,
// beside the column it is about.
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useHeldPlace } from "@/components/console/PlaceScope";
import { Section } from "@/components/shared/Section";
import { Half } from "@/components/shared/Half";
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
import { GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";

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
        {/* THE DOOR TO THE DIAL (MESITA-1953). Rewards merged into this product
            in the catalogue, and the card was the only way in — the rail here
            carries no product rows at all, so without this link
            `/places/<id>/rewards` is reachable by typing it and by nothing
            else. That is the same stranding `products/pay` needed a back link
            for (MESITA-1943).

            A DOOR, NOT THE DIAL ITSELF. The strategy still lives on one screen,
            because one product's state settable in two places is how two
            screens start disagreeing about which dial is live — which is the
            reason this view has carried no rewards box since MESITA-1928. What
            merged is the CARD; the setting did not move. */}
        <Section
          title="What comes back"
          description="How much of each settled bill goes back to the guest."
          right={
            <Link
              href={placeTabHref(place.id, "rewards")}
              className={GHOST_PILL_BUTTON_CLASS}
            >
              Open Rewards
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          }
          lane
        >
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            Rewards are {place.visitRewards ? "on" : "off"} here.{" "}
            {place.visitRewards
              ? "Every settled bill pays out at the rate the strategy sets."
              : "Bills still close and still land on the record — nothing goes back until a strategy is on."}
          </p>
        </Section>
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
