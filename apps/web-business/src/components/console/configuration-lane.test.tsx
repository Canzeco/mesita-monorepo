// The Configuration page stops stranding content, and stops lying about
// Stripe (MESITA-1861).
//
// Two of these assert a BIJECTION rather than a single branch: "a failed read
// shows no Connect button" is worth nothing on its own, because a test that
// renders nothing passes it. Each pairs with the opposite input and asserts
// the opposite output, so the pair fails if the branch stops discriminating.
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PaymentsCard } from "./PaymentsCard";
import { SoonStrip } from "./SoonStrip";
import { Section } from "@/components/shared/Section";

const CARD_SRC = readFileSync(path.join(__dirname, "./PaymentsCard.tsx"), "utf8");
const PARTNER_SRC = readFileSync(path.join(__dirname, "./PartnerCard.tsx"), "utf8");
const PAGE_SRC = readFileSync(
  path.join(__dirname, "../../app/(shell)/orgs/[orgId]/configuration/page.tsx"),
  "utf8",
);

function card(over: Partial<Parameters<typeof PaymentsCard>[0]> = {}) {
  return renderToStaticMarkup(
    <PaymentsCard
      orgId="org-1"
      account={null}
      orphaned={false}
      isOwner
      loadError={null}
      {...over}
    />,
  );
}

describe("a failed account read is not an absent account", () => {
  it("says the read failed, and offers nothing", () => {
    const html = card({ loadError: "Couldn't load the Stripe account." });
    expect(html).toContain("Couldn&#x27;t load the Stripe account.");
    // The whole point: no claim about the account, no button that makes a
    // second one. Before MESITA-1861 this branch rendered both.
    expect(html).not.toContain("No account");
    expect(html).not.toContain("Connect Stripe");
  });

  it("but a genuine absence still says so, and still offers the button", () => {
    const html = card();
    expect(html).toContain("No account");
    expect(html).toContain("Connect Stripe");
  });

  it("the page gives the failure its own name instead of reusing null", () => {
    expect(PAGE_SRC).toContain("accountError");
    // stripeReady must not read "not ready" out of an unread account.
    expect(PAGE_SRC).toMatch(/accountError === null &&\s*\n\s*account !== null/);
  });
});

describe("the boxes stop stranding content at opposite edges", () => {
  it("no DataRow carries an empty label any more", () => {
    // An emptied label leaves the ROW: an empty left cell, a hairline, and
    // the value alone at the far right of a ~1690px card.
    expect(CARD_SRC).not.toMatch(/<DataRow\s+label=""/);
  });

  it("the connect button no longer sits alone in a justify-end", () => {
    expect(CARD_SRC).not.toContain('className="flex justify-end"');
  });

  it("PartnerCard's fixed right well is gone from every branch", () => {
    // The docblock still NAMES the class it deleted, which is the point of a
    // docblock — so strip comments before asserting, or this passes only
    // while nobody explains themselves.
    const code = PARTNER_SRC.replace(/\/\/[^\n]*/g, "");
    expect(code).not.toContain("w-[9.5rem]");
    expect(code).not.toContain("sm:w-[11rem]");
  });
});

describe("Section's lane is opt-in and caps nothing", () => {
  const body = <p>body</p>;

  it("lane splits into a label lane and a content lane from lg", () => {
    const html = renderToStaticMarkup(
      <Section lane title="Stripe" description="d">{body}</Section>,
    );
    expect(html).toContain("lg:grid-cols-[288px_minmax(0,1fr)]");
  });

  it("without the prop the card is unchanged — stacked, no grid", () => {
    const html = renderToStaticMarkup(
      <Section title="Stripe" description="d">{body}</Section>,
    );
    expect(html).not.toContain("lg:grid-cols-");
    expect(html).toContain("flex flex-col gap-3");
  });

  it("never introduces a max-width — the console is fluid (MESITA-1836)", () => {
    const html = renderToStaticMarkup(
      <Section lane title="Stripe" description="d">{body}</Section>,
    );
    expect(html).not.toMatch(/\bmax-w-/);
  });
});

describe("the unbuilt boxes stop out-shouting the live ones", () => {
  const soon = renderToStaticMarkup(<SoonStrip title="Brand" line="l" />);
  const live = renderToStaticMarkup(
    <Section title="Stripe" description="d"><p>b</p></Section>,
  );

  it("both families share one title size and one radius", () => {
    expect(soon).toContain("font-display text-sm font-semibold tracking-tight");
    expect(live).toContain("font-display text-sm font-semibold tracking-tight");
    expect(soon).toContain("rounded-2xl");
    expect(live).toContain("rounded-2xl");
  });

  it("rank comes from depth: live boxes lift, Soon boxes lie flat", () => {
    expect(live).toContain("shadow-card");
    expect(soon).not.toContain("shadow-card");
    expect(soon).toContain("border-dashed");
    expect(live).not.toContain("border-dashed");
  });
});

describe("the page reads the dependency, not the alphabet", () => {
  it("Stripe, then what it unlocks, then who may touch it, then the Soons", () => {
    const order = ["Stripe", "Partnership", "MembersCard", "SOON_STRIPS.brand"]
      .map((needle) => PAGE_SRC.indexOf(`"${needle}"`) >= 0
        ? PAGE_SRC.indexOf(`"${needle}"`)
        : PAGE_SRC.lastIndexOf(needle));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("the caption is grouped with its title, not spaced like a sibling card", () => {
    expect(PAGE_SRC).toMatch(/flex flex-col gap-1[\s\S]{0,400}<h1/);
  });
});

// MESITA-1863. The box used to list Mesita Pay, Visit Rewards and Accept
// Prepays under the on switch. Joining writes `partnered` and
// `mesita_pay_enabled` and puts every held place on plan=pro at ZERO rates —
// so all three are partner-GATED and none is partner-DELIVERED. The operator
// read that the partnership had unlocked them, then met three off switches on
// Capabilities. The gate belongs where each rung states its own prerequisite:
// the ladder.
describe("Partnership is the gate, never the delivery", () => {
  const NAMED = ["Mesita Pay", "Visit Rewards", "Accept Prepays"];

  it("neither the card nor the page names a capability the switch does not turn on", () => {
    const code = PARTNER_SRC.replace(/\/\/[^\n]*/g, "");
    for (const name of NAMED) {
      expect(code).not.toContain(name);
      expect(PAGE_SRC).not.toContain(name);
    }
  });

  it("the ladder still names the gate, so the claim lives where it is true", () => {
    const ladder = readFileSync(
      path.join(__dirname, "../place-manage/sections/controls/offerings.ts"),
      "utf8",
    );
    expect(ladder).toContain("the gate for everything below");
    expect(ladder).toContain("Needs the partnership");
  });
});
