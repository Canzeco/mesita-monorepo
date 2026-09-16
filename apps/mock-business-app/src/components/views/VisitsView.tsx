"use client";

// Visits — the container guests arrive through, and the in-person checkout.
//
// VISITS' ZONE IS EMPTY, deliberately. Rewards is its own product again and
// owns the strategy dial; the Visits card carries no rewards clause, and this
// view carries no rewards box. One product's state must be settable in one
// place, or two screens will disagree about which dial is live.
import { useHeldPlace } from "@/components/console/PlaceScope";
import { Section } from "@/components/shared/Section";
import { Table, type Column } from "@/components/shared/Table";
import { Tiles } from "@/components/shared/Tiles";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/shared/Badges";
import { VISITS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import type { MockTender, MockVisit } from "@/mock/types";
import { dayTime, money } from "@/lib/format";
import { GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";

const STATE_TONE: Record<MockVisit["state"], "good" | "warn" | "bad"> = {
  settled: "good",
  open: "warn",
  voided: "bad",
};

/** The stored key is `mesita_pay` and the noun an operator reads is Payments,
 *  the same split `lib/product-keys.ts` makes for the product itself. Cash and
 *  Card are two words now because they are two rows; the database stored both
 *  as `at_place` until MESITA-1910, which is why one chip could not say which. */
const TENDER_LABEL: Record<MockTender["method"], string> = {
  cash: "Cash",
  card: "Card",
  mesita_pay: "Payments",
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
      <Section
        title="Visit checkout"
        description="How a bill is closed at the table. The guest scans, the reward applies, and the visit settles."
        right={<button type="button" className={GHOST_PILL_BUTTON_CLASS}>How it works</button>}
        lane
      >
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          Every visit below arrived through the guest&rsquo;s own app. There is no
          terminal to install and nothing for staff to press: the reward is
          applied before the total is shown, which is the only moment a guest
          will believe it. A bill can be settled by more than one tender, so
          <strong> Paid with</strong> lists each one — and those, plus Credits,
          add up to the total.
        </p>
      </Section>
      <Section title="Recent visits" description="Newest first.">
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
    </div>
  );
}
