// The Configuration page stops stranding content, and stops lying about
// Stripe (MESITA-1861). Then it splits into two tiers (MESITA-1867): Mesita
// Partner, the yearly subscription, and Mesita Pay, the Stripe add-on that
// the old Partner switch became.
//
// Most of these assert a BIJECTION rather than a single branch: "a failed read
// shows no Connect button" is worth nothing on its own, because a test that
// renders nothing passes it. Each pairs with the opposite input and asserts
// the opposite output, so the pair fails if the branch stops discriminating.
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PaymentsCard } from "./PaymentsCard";
import { PARTNER_PERKS, PartnerCard } from "./PartnerCard";
import { MesitaPayCard } from "./MesitaPayCard";
import { LockedStrip, SoonStrip } from "./SoonStrip";
import { CARD_PAYMENTS_LIVE } from "./badges";
import { Section } from "@/components/shared/Section";
import type { PaymentAccountState } from "@/lib/model/types";

const CARD_SRC = readFileSync(path.join(__dirname, "./PaymentsCard.tsx"), "utf8");
const PARTNER_SRC = readFileSync(path.join(__dirname, "./PartnerCard.tsx"), "utf8");
const PAGE_SRC = readFileSync(
  path.join(__dirname, "../../app/(shell)/orgs/[orgId]/configuration/page.tsx"),
  "utf8",
);
const LOADING_SRC = readFileSync(
  path.join(__dirname, "../../app/(shell)/orgs/[orgId]/configuration/loading.tsx"),
  "utf8",
);
const LADDER_SRC = readFileSync(
  path.join(__dirname, "../place-manage/sections/controls/offerings.ts"),
  "utf8",
);

/** Line comments, block comments and JSX comments, gone — so a docblock that
 *  NAMES what it deleted cannot make a "not present" assertion pass or fail
 *  on the strength of somebody explaining themselves. */
function stripComments(src: string) {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

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
    const code = stripComments(PARTNER_SRC);
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

// MESITA-1867. A tier the organization cannot reach yet is not an unbuilt
// engine, but it ranks the same way: flat, dashed, one row. What changes is
// the glyph — a lock says the "not yet" is on the organization, a Soon pill
// says it is on us. One geometry, so the two flat rows cannot drift apart the
// way Soon and Section once did (MESITA-1861).
describe("a locked tier lies as flat as a Soon one, and says which it is", () => {
  const locked = renderToStaticMarkup(
    <LockedStrip title="Mesita Pay" line="Needs Mesita Partner first." />,
  );
  const soon = renderToStaticMarkup(<SoonStrip title="Brand" line="l" />);

  it("shares the strip's geometry: dashed, no lift, one title size", () => {
    for (const html of [locked, soon]) {
      expect(html).toContain("border-dashed");
      expect(html).not.toContain("shadow-card");
      expect(html).toContain("font-display text-sm font-semibold tracking-tight");
    }
  });

  it("the lock and the Soon pill are exclusive — never both, never neither", () => {
    expect(locked).toContain("lucide-lock");
    expect(locked).not.toContain(">Soon<");
    expect(soon).toContain(">Soon<");
    expect(soon).not.toContain("lucide-lock");
    // And a locked strip is not a switch: no track, no control that pretends.
    expect(locked).not.toContain("h-6 w-11");
    expect(locked).not.toContain('role="switch"');
  });
});

describe("the page reads the dependency, not the alphabet", () => {
  it("Mesita Partner, then Mesita Pay, then who may touch it, then the Soons", () => {
    // Title attributes and component tags, not bare words: the docblock names
    // every one of these boxes before the JSX does.
    const order = [
      'title="Mesita Partner"',
      "<PartnerCard",
      'title="Mesita Pay"',
      "<MesitaPayCard",
      "<MembersCard",
      "SOON_STRIPS.brand",
      "SOON_STRIPS.developers",
    ].map((needle) => PAGE_SRC.indexOf(needle));
    for (const at of order) expect(at).toBeGreaterThan(-1);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("the caption is grouped with its title, not spaced like a sibling card", () => {
    expect(PAGE_SRC).toMatch(/flex flex-col gap-1[\s\S]{0,400}<h1/);
  });

  // A skeleton is a promise about what is coming (MESITA-1729). Five boxes in
  // the page's order at the page's heights, or every load ends in a shift by
  // exactly the distance the split moved things.
  it("the skeleton promises the same five boxes, in order, at their heights", () => {
    const heights = [...LOADING_SRC.matchAll(/bg-muted (h-\S+) animate-pulse rounded-2xl/g)]
      .map((m) => m[1]);
    // Partner is the tall one (price, seam, lead, three lines); Pay is the
    // STRIP, because not-partnered is the state every new organization lands
    // in; Members; then two Soon strips.
    expect(heights).toEqual(["h-48", "h-[72px]", "h-32", "h-[72px]", "h-[72px]"]);
  });
});

// MESITA-1863 said Partnership is the GATE, never the delivery: joining put
// every held place on plan=pro at ZERO rates, so listing Mesita Pay, Visit
// Rewards and Accept Prepays under the switch sent the operator to three off
// switches on Capabilities right after reading that the partnership had
// unlocked them. MESITA-1867 puts a price on the tier, and a price with no
// price list is a price nobody can read — so the box lists what the gate
// OPENS again, under a lead that says each place turns these on itself, with
// a dash where a check would read "done". The claim "Needs Mesita Partner"
// still lives where it is true: on the ladder rung that states its own
// prerequisite.
describe("Partnership is the gate, never the delivery", () => {
  const partner = (over: Partial<Parameters<typeof PartnerCard>[0]> = {}) =>
    renderToStaticMarkup(<PartnerCard partnered={false} isOwner {...over} />);

  it("the lead hands the verb to the place, once, in every state", () => {
    expect(stripComments(PARTNER_SRC)).toContain("turns these on");
    for (const html of [partner(), partner({ partnered: true })]) {
      expect(html.split("turns these on").length - 1).toBe(1);
      expect(html).toContain("from Rewards and Capabilities");
    }
  });

  it("no perk claims to turn anything on by itself", () => {
    expect(PARTNER_PERKS.length).toBe(3);
    for (const [name, clause] of PARTNER_PERKS) {
      expect(`${name} ${clause}`).not.toMatch(/\bturns? (?:\w+ )?on\b/i);
    }
    // The badge is a sub-clause of the third line, qualified to the state a
    // subscriber actually lands in: every place joins at Zero.
    expect(PARTNER_PERKS[2][1]).toContain("once a strategy is on");
  });

  it("the marker is a dash, never a check — a check means done on this route", () => {
    const code = stripComments(PARTNER_SRC);
    expect(code).not.toContain("lucide-check");
    expect(code).not.toMatch(/import\s*\{[^}]*\bCheck\b[^}]*\}\s*from\s*"lucide-react"/);
    for (const html of [partner(), partner({ partnered: true })]) {
      expect(html).not.toContain("lucide-check");
      // React emits the character, not the entity: one en dash per perk.
      expect((html.match(/shrink-0">\u2013</g) ?? []).length).toBe(PARTNER_PERKS.length);
    }
  });

  it("the ladder still names the gate, so the claim lives where it is true", () => {
    expect(LADDER_SRC).toContain("the gate for everything below");
    expect(LADDER_SRC).toContain("Needs Mesita Partner");
    // The old wording is gone with the old tier.
    expect(LADDER_SRC).not.toContain("Needs the partnership");
  });

  it("nothing on this page calls the tier free", () => {
    for (const src of [PARTNER_SRC, PAGE_SRC]) {
      expect(stripComments(src)).not.toMatch(/\bfree\b/i);
    }
  });
});

// MESITA-1867. The Partner box is a price, a door and a price list. Not
// partnered: the price at display rank and, for an owner, the one CTA — no
// pill, because the CTA IS the state. Partnered: the shared pill and "Renews
// yearly." Each state is asserted against its opposite.
describe("Mesita Partner is a price, a door, and a price list", () => {
  const partner = (over: Partial<Parameters<typeof PartnerCard>[0]> = {}) =>
    renderToStaticMarkup(<PartnerCard partnered={false} isOwner {...over} />);

  it("the door is the owner's: non-owners read who subscribes instead", () => {
    const owner = partner();
    const editor = partner({ isOwner: false });
    expect(owner).toContain("Become a partner");
    expect(owner).not.toContain("An owner subscribes.");
    expect(editor).not.toContain("Become a partner");
    expect(editor).toContain("An owner subscribes.");
  });

  it("not partnered prints the price from the one source; partnered does not", () => {
    const off = partner();
    const on = partner({ partnered: true });
    expect(off).toContain("MX$1,000");
    expect(off).toContain("+ IVA a year");
    // Display rank, the price is the box's anchor.
    expect(off).toMatch(/font-display text-lg font-semibold tracking-tight[^>]*>MX\$1,000</);
    expect(on).not.toContain("MX$1,000");
  });

  it("partnered wears the shared pill and says it renews; the door is gone", () => {
    const on = partner({ partnered: true });
    const off = partner();
    // The pill's dot is its signature: "Partner" alone also appears in the
    // third perk, so the word cannot be the witness.
    expect(on).toContain("bg-violet-500");
    expect(on).toContain("Renews yearly.");
    expect(on).toContain("Renewal and cancellation land with the next release.");
    expect(on).not.toContain("Become a partner");
    expect(on).not.toContain("An owner subscribes.");
    // And no pill where the CTA is the state: never three atoms for one fact.
    expect(off).not.toContain("bg-violet-500");
    expect(off).not.toContain("Renews yearly.");
  });

  it("the modal restates the commitment and has no button that pretends", () => {
    // Static render never opens it, so the source is the witness. A disabled
    // Continue would be a knob that pretends (SoonStrip.tsx); the CTA that
    // opens the modal already demonstrates the door.
    const start = PARTNER_SRC.indexOf("<Modal");
    const end = PARTNER_SRC.indexOf("</Modal>");
    expect(start).toBeGreaterThan(-1);
    const modal = stripComments(PARTNER_SRC.slice(start, end));
    expect(modal).toContain('title="Mesita Partner"');
    expect(modal).toContain("Checkout lands with the next release.");
    expect(modal).not.toContain("<button");
    expect(modal).toContain("<PriceLine />");
    expect(modal).toContain("<Perks />");
  });

  it("the page lifts Mesita Pay only for a partner, and locks it flat otherwise", () => {
    const branch = PAGE_SRC.indexOf("{partnered ? (");
    const elseAt = PAGE_SRC.indexOf(") : (", branch);
    const endAt = PAGE_SRC.indexOf(")}", elseAt);
    expect(branch).toBeGreaterThan(-1);
    expect(elseAt).toBeGreaterThan(branch);
    expect(endAt).toBeGreaterThan(elseAt);
    const yes = PAGE_SRC.slice(branch, elseAt);
    const no = PAGE_SRC.slice(elseAt, endAt);
    expect(yes).toContain('title="Mesita Pay"');
    expect(yes).toContain("<PaymentsCard");
    expect(yes).toContain("<MesitaPayCard");
    expect(yes).not.toContain("<LockedStrip");
    expect(no).toContain("<LockedStrip");
    expect(no).toContain('title="Mesita Pay"');
    expect(no).not.toContain("<MesitaPayCard");
    expect(no).not.toContain("<PaymentsCard");
    // Each exactly once on the page: one lifted face, one flat face.
    expect((PAGE_SRC.match(/<MesitaPayCard/g) ?? []).length).toBe(1);
    expect((PAGE_SRC.match(/<LockedStrip/g) ?? []).length).toBe(1);
    // The Partner box is unconditional — it is the one live box to act on.
    expect(PAGE_SRC.indexOf("<PartnerCard")).toBeLessThan(branch);
  });
});

// MESITA-1864. Locked used to render a pill and a sentence where the other
// two branches render a control, so the state every new organization actually
// meets — Stripe not Ready — was the one that never showed the switch as a
// thing you turn on. MESITA-1867 moved that switch from Partner to Mesita
// Pay; the idiom holds: every branch a track and one line. The switch is
// `aria-disabled` in every branch this PR, because `mesita_pay_enabled` has
// no writer of its own until MESITA-1868 — so "unlocked" here means the knob
// lifts and the line says when it will flip, never that it flips.
describe("the Mesita Pay switch shows while it is locked", () => {
  const pay = (over: Partial<Parameters<typeof MesitaPayCard>[0]> = {}) =>
    renderToStaticMarkup(
      <MesitaPayCard
        partnered
        stripeReady
        mesitaPayEnabled={false}
        isOwner
        accountState="live"
        orphaned={false}
        loadError={null}
        {...over}
      />,
    );
  const LOCKED_STATES: [PaymentAccountState, string][] = [
    ["none", "Needs a Ready Stripe account — connect Stripe first."],
    ["unfinished", "Finish Stripe onboarding first."],
    ["in_review", "Stripe is checking the account."],
    ["restricted", "Stripe restricted the account — see above."],
    ["charges_only", "Stripe still needs payouts enabled — see above."],
  ];

  it("every branch renders a track named Mesita Pay — locked included", () => {
    const branches = [
      pay({ partnered: false }),
      pay({ loadError: "Couldn't load the Stripe account." }),
      ...LOCKED_STATES.map(([accountState]) => pay({ stripeReady: false, accountState })),
      pay(),
      pay({ mesitaPayEnabled: true }),
      pay({ isOwner: false }),
      pay({ isOwner: false, mesitaPayEnabled: true }),
    ];
    for (const html of branches) {
      expect(html).toContain("h-6 w-11");
      expect(html).toContain('aria-label="Mesita Pay"');
      expect(html).toContain('role="switch"');
      expect(html).toContain('aria-disabled="true"');
      // The pill is gone: one control, one line, never a third atom.
      expect(html).not.toContain("type-label");
    }
  });

  it("locked reads off, carries the lock, and names the rung the account is on", () => {
    for (const [accountState, line] of LOCKED_STATES) {
      const html = pay({ stripeReady: false, accountState });
      expect(html, accountState).toContain('aria-checked="false"');
      expect(html, accountState).toContain(line);
      expect(html, accountState).toContain("lucide-lock");
      // The locked thumb does not pretend to lift.
      expect(html, accountState).not.toContain("bg-background shadow");
    }
    // Never "connect first" to someone who did: the four lines discriminate.
    const lines = LOCKED_STATES.map(([accountState]) => pay({ stripeReady: false, accountState }));
    expect(new Set(lines).size).toBe(lines.length);
  });

  it("an orphaned mirror is an absent account, whatever state it reads", () => {
    const orphaned = pay({ stripeReady: false, accountState: "restricted", orphaned: true });
    const kept = pay({ stripeReady: false, accountState: "restricted" });
    expect(orphaned).toContain("Needs a Ready Stripe account — connect Stripe first.");
    expect(kept).toContain("Stripe restricted the account — see above.");
    expect(kept).not.toContain("connect Stripe first");
  });

  it("a failed read locks with its own line, and asserts nothing about readiness", () => {
    const failed = pay({ loadError: "Couldn't load the Stripe account." });
    const read = pay();
    expect(failed).toContain("Couldn&#x27;t read the Stripe account.");
    expect(failed).toContain('aria-checked="false"');
    expect(failed).not.toContain("bg-background shadow");
    expect(failed).not.toContain("connect Stripe first");
    expect(read).not.toContain("read the Stripe account");
    expect(read).toContain("bg-background shadow");
  });

  it("not partnered locks on the subscription, even with the column on (2am test)", () => {
    // A hand-migrated row with `mesita_pay_enabled` on and no subscription
    // must never show a live switch. Same inputs, partnered flipped.
    const orphanRow = pay({ partnered: false, mesitaPayEnabled: true });
    const partner = pay({ mesitaPayEnabled: true });
    expect(orphanRow).toContain("Needs Mesita Partner first.");
    expect(orphanRow).toContain('aria-checked="false"');
    expect(orphanRow).not.toContain("bg-background shadow");
    expect(partner).not.toContain("Needs Mesita Partner first.");
    expect(partner).toContain('aria-checked="true"');
    expect(partner).toContain("bg-background shadow");
  });

  it("unlocked keeps the live track, no lock in the knob, and is honest about the release", () => {
    const owner = pay();
    const editor = pay({ isOwner: false });
    for (const html of [owner, editor]) {
      expect(html).toContain("bg-background shadow");
      expect(html).not.toContain("lucide-lock");
      expect(html).toContain('aria-disabled="true"');
    }
    expect(owner).toContain("Switch lands with the next release.");
    expect(owner).not.toContain("An owner turns this on.");
    expect(editor).toContain("An owner turns this on.");
    expect(editor).not.toContain("next release");
  });

  it("the on/off line follows CARD_PAYMENTS_LIVE, so it cannot contradict the Ready caption", () => {
    const on = pay({ mesitaPayEnabled: true });
    const off = pay();
    expect(on).toContain('aria-checked="true"');
    expect(off).toContain('aria-checked="false"');
    // Both branches literal on purpose: deriving the expectation from
    // `mesitaPaySwitchLine` would pass by construction.
    if (CARD_PAYMENTS_LIVE) {
      expect(on).toContain("Guests can pay by card at every place that turns it on.");
      expect(off).toContain("Turn on so places can take card payments inside Mesita.");
    } else {
      expect(on).toContain(
        "Places can turn on card payments; Mesita starts sending them when card payments go live.",
      );
      expect(off).toContain("Turn on so places can offer card payments once they go live.");
      // Not live: the switch must not claim money moves.
      expect(on).not.toContain("Guests can pay by card");
    }
    expect(on).not.toContain("Turn on so");
    expect(off).not.toContain("Places can turn on card payments");
  });
});
