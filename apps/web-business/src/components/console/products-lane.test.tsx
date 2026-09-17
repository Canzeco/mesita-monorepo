// The two paid tiers — Mesita Partner, the yearly subscription, and Mesita
// Pay, the Stripe add-on that the old Partner switch became (MESITA-1867) —
// and the page that composes them.
//
// That page was Configuration for one day; MESITA-1869 moved both boxes to
// PRODUCTS, where an operator goes to buy, and this file followed them. What
// MESITA-1861 asserted about stranded content and about lying about Stripe is
// unchanged, and asserted against the new page.
//
// Most of these assert a BIJECTION rather than a single branch: "a failed read
// shows no Connect button" is worth nothing on its own, because a test that
// renders nothing passes it. Each pairs with the opposite input and asserts
// the opposite output, so the pair fails if the branch stops discriminating.
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// The Pay switch writes and then refreshes (MESITA-1891), so it holds a
// router. There is no App Router under `renderToStaticMarkup` — `useRouter`
// throws "invariant expected app router to be mounted" — so the module is
// stubbed, the same way sidebar-render.test.tsx stubs it. `redirect` is in
// the factory because `actions/place-setup.ts` imports it by name and an ESM
// namespace missing a named export fails at link time, long before anything
// calls it.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(""),
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { PaymentsCard } from "./PaymentsCard";
import { ManageMembership, PARTNER_PERKS, PartnerCard } from "./PartnerCard";
import { MesitaPayCard } from "./MesitaPayCard";
import { SoonStrip } from "./SoonStrip";
import { CARD_PAYMENTS_LIVE } from "./badges";
import { Section } from "@/components/shared/Section";
import type { PaymentAccountState } from "@/lib/model/types";

const CARD_SRC = readFileSync(path.join(__dirname, "./PaymentsCard.tsx"), "utf8");
const PARTNER_SRC = readFileSync(path.join(__dirname, "./PartnerCard.tsx"), "utf8");
const PAGE_SRC = readFileSync(
  path.join(__dirname, "../../app/(shell)/places/[id]/products/page.tsx"),
  "utf8",
);
// Mesita Pay's controls got their own address (MESITA-1872): Pato took the
// Section off the catalogue — *"just leave the 8 boxes and the 1 partnership
// box shit"* — so the composition this file asserts lives one path deeper.
const PAY_SRC = readFileSync(
  path.join(__dirname, "../../app/(shell)/places/[id]/products/pay/page.tsx"),
  "utf8",
);
const LOADING_SRC = readFileSync(
  path.join(__dirname, "../../app/(shell)/places/[id]/products/loading.tsx"),
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
      placeId="p-1"
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
    expect(PAY_SRC).toContain("accountError");
    // stripeReady must not read "not ready" out of an unread account.
    expect(PAY_SRC).toMatch(/accountError === null &&\s*\n\s*account !== null/);
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

// LOCKEDSTRIP IS GONE (MESITA-1869), and so is the describe that rendered it.
//
// MESITA-1867 built it for one caller: Mesita Pay, flat and dashed with a lock
// where the Soon pill sits, on a Configuration page that had to show the tier
// even to a tenant that could not reach it. The catalogue says that sentence
// now — the Mesita Pay CARD reads "Locked · Needs Mesita Partner" — and the
// page simply does not render the box until the place can touch it. An
// exported component nobody renders is an invitation to say the
// same thing twice on one screen, which is the note badges.tsx already wrote
// about `ORG_STATE_BADGE`.
//
describe("the catalogue reads the dependency, not the alphabet", () => {
  // MESITA-1872. Pato, on the live catalogue: *"remove thus shit. just leave
  // the 8 boxes and the 1 partnership box shit. payments log go into
  // activity."* The page is the banner and the grid; a full Section for ONE
  // of the eight made that one louder than the other seven on the page whose
  // whole job is comparing them.
  it("the catalogue is the partnership and the grid, and NOTHING else", () => {
    const order = ["<PartnerBanner", "<ProductCatalog"].map((n) =>
      PAGE_SRC.indexOf(n),
    );
    for (const at of order) expect(at).toBeGreaterThan(-1);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // The box left, and so did the read that fed it: two screens reading one
    // Stripe account is how the console starts disagreeing with itself.
    // Through stripComments: the docblock NAMES what it deleted, and a
    // "not present" assertion must not pass or fail on an explanation.
    const code = stripComments(PAGE_SRC);
    for (const gone of [
      "<PaymentsCard",
      "<MesitaPayCard",
      'title="Online Payments"',
      "apiGetPaymentAccount",
      "ConnectReturnNotice",
      "SoonStrip",
    ]) {
      expect(code, gone).not.toContain(gone);
    }
    // And the anchor went with it. `#mesita-pay` into a Section that no
    // longer exists scrolls NOWHERE, silently — the worst kind of dead link,
    // which is why the verb is a real address now.
    expect(code).not.toContain("#mesita-pay");
    expect(PAGE_SRC).toContain("placePayHref(id)");
  });

  it("the payments log moved to Activity, which is where readings live", () => {
    const activity = readFileSync(
      path.join(__dirname, "../../app/(shell)/places/[id]/activity/page.tsx"),
      "utf8",
    );
    // ONCE now, not twice (MESITA-1892). The second render was the ORG
    // page's no-place branch, which returned early with `NoPlaceYet` and the
    // strip; Activity is one place's page, so a caller with no place never
    // reaches it — the flat `/activity` answers with the next step instead.
    expect((activity.match(/SOON_STRIPS\.payments/g) ?? []).length).toBe(1);
    // The skeleton grew with it, or every load ends in a 72px shift.
    const loading = readFileSync(
      path.join(__dirname, "../../app/(shell)/places/[id]/activity/loading.tsx"),
      "utf8",
    );
    expect(loading).toContain('"h-[220px]", "h-[72px]"');
  });

  it("the page adds NO heading of its own — the place layout owns the h1", () => {
    // MESITA-1892. Every address under `places/[id]` renders beneath
    // `PlaceHeading`, which names the venue and then the page. A second `h1`
    // here would be the third time one screen says where you are.
    expect(stripComments(PAGE_SRC)).not.toContain("<h1");
    expect(stripComments(LOADING_SRC)).not.toContain("h-7 w-56");
  });

  // A skeleton is a promise about what is coming (MESITA-1729). The
  // catalogue's promise is the GRID: eight tiles, because eight is what the
  // page renders in every state — no read can make a product disappear.
  it("the skeleton promises the grid, at the grid's own breakpoints", () => {
    expect(LOADING_SRC).toContain("sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4");
    const tiles = LOADING_SRC.slice(LOADING_SRC.indexOf("grid grid-cols-1"));
    expect(tiles).toContain("[0, 1, 2, 3, 4, 5, 6, 7]");
    // And the three filter pills above it, which are a row the page always
    // draws — a skeleton that skipped them would shift the grid down 32px on
    // every load.
    expect(LOADING_SRC).toContain("rounded-full");
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
  const partner = (
    over: Partial<Omit<Parameters<typeof PartnerCard>[0], "placeId">> = {},
  ) =>
    renderToStaticMarkup(
      <PartnerCard placeId="p-1" partnered={false} isOwner {...over} />,
    );

  it("the lead hands the verb to the place, once, in every state", () => {
    expect(stripComments(PARTNER_SRC)).toContain("turns these on");
    for (const html of [partner(), partner({ partnered: true })]) {
      expect(html.split("turns these on").length - 1).toBe(1);
      // NOT "from Rewards and Capabilities" any more: MESITA-1885 retired
      // both views and split them into one per product, so the lead names the
      // set rather than two addresses that stopped existing.
      expect(html).toContain("from its own product views");
      expect(html).not.toContain("Capabilities");
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
// pill, because the CTA IS the state. Partnered: the shared pill and when it
// renews. Each state is asserted against its opposite.
//
// MESITA-1877 gave the door somewhere to go: the modal's INFO line became a
// real Continue, the price comes off the catalog, and the partnered state
// prints a DATE. The copy laws under that date are asserted below, because
// they are the two ways this line can lie to an operator about money.
describe("Mesita Partner is a price, a door, and a price list", () => {
  const partner = (
    over: Partial<Omit<Parameters<typeof PartnerCard>[0], "placeId">> = {},
  ) =>
    renderToStaticMarkup(
      <PartnerCard placeId="p-1" partnered={false} isOwner {...over} />,
    );

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
    expect(on).toContain("--tier-gold");
    // No membership row on the payload — the operator switch, a migration, or
    // a failed billing read. All the console knows is the cadence.
    expect(on).toContain("Renews yearly.");
    expect(on).not.toContain("Become a partner");
    expect(on).not.toContain("An owner subscribes.");
    // And no pill where the CTA is the state: never three atoms for one fact.
    expect(off).not.toContain("--tier-gold");
    expect(off).not.toContain("Renews yearly.");
  });

  // MESITA-1877. `membershipLine` is the one place that turns a subscription
  // into a sentence, and there are exactly two sentences it must never write.
  it("a membership that is ENDING never wears the word renews", () => {
    const html = partner({
      partnered: true,
      membership: {
        state: "active",
        renewsAt: "2027-09-14T00:00:00.000Z",
        cancelAtPeriodEnd: true,
      },
    });
    expect(html).not.toMatch(/Renews/);
    expect(html).toMatch(/Ends .*2027/);
  });

  it("past due is still a partner, and says what needs doing", () => {
    const html = partner({
      partnered: true,
      membership: {
        state: "past_due",
        renewsAt: "2027-09-14T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      },
    });
    expect(html).toContain("--tier-gold");
    expect(html).toContain("Payment due");
    // LAPSE ≠ DROP: nothing here may read as the partnership being over.
    expect(html).not.toMatch(/expired|no longer|cancelled|canceled/i);
    expect(html).not.toContain("Become a partner");
  });

  it("the price is the catalog's, and the label is only the fallback", () => {
    const html = partner({ price: { priceCents: 150000, currency: "MXN" } });
    expect(html).toContain("MX$1,500");
    expect(html).not.toContain("MX$1,000");
    // The suffix is not billing data: "a year" is the catalog interval and
    // IVA is a fact about selling in Mexico, so neither rides the wire.
    expect(html).toContain("+ IVA a year");
  });

  it("the modal restates the commitment and now carries the real button", () => {
    // Static render never opens it, so the source is the witness. The
    // placeholder INFO line is gone: MESITA-1877 shipped the checkout, and a
    // promise where a button belongs is only honest while there is nothing to
    // press.
    const start = PARTNER_SRC.indexOf("<Modal");
    const end = PARTNER_SRC.indexOf("</Modal>");
    expect(start).toBeGreaterThan(-1);
    const modal = stripComments(PARTNER_SRC.slice(start, end));
    // The MONEY moment is the one place the word Membership is allowed.
    expect(modal).toContain('title="Mesita Membership"');
    expect(modal).not.toContain("Checkout lands with the next release.");
    expect(modal).toContain("<BuyForm");
    // Order: price, then what it buys, then the commitment. Nobody decides
    // before reading what they are deciding about.
    expect(modal.indexOf("<PriceLine")).toBeLessThan(modal.indexOf("<Perks"));
    expect(modal.indexOf("<Perks")).toBeLessThan(modal.indexOf("<BuyForm"));
  });

  it("the buy button is a form, disabled while it opens, and never fakes", () => {
    const buy = stripComments(
      PARTNER_SRC.slice(PARTNER_SRC.indexOf("function BuyForm")),
    );
    // A server action that redirects to Stripe only redirects from a form
    // submit, never from an onClick handler.
    expect(buy).toContain("<form action={action}");
    expect(buy).toContain("startMembershipAction");
    // A Checkout session is a network hop; a second click is a second
    // session, and the owner pays for whichever one they finish.
    expect(buy).toContain("disabled={pending}");
    expect(buy).toContain("Continue to checkout");
  });

  // MESITA-1869 moved the LOCKED face off the catalogue and into the grid;
  // MESITA-1872 moved the LIVE face onto its own address. The card already
  // reads "Locked · Needs Mesita Partner", so the Pay page says it once more
  // — with the door — and never as a second locked box.
  it("the Mesita Pay page is one box for a partner, and a door otherwise", () => {
    expect(PAY_SRC).toContain("if (!partnered) {");
    expect(PAY_SRC).not.toContain("<LockedStrip");
    // One box, one switch, one account: a second face is how two screens
    // start disagreeing about one Stripe account.
    expect((PAY_SRC.match(/<MesitaPayCard/g) ?? []).length).toBe(1);
    expect((PAY_SRC.match(/<PaymentsCard/g) ?? []).length).toBe(1);
    // Stripe's stored return travels with the account it is about.
    expect(PAY_SRC).toContain("ConnectReturnNotice");
    // The non-partner branch returns BEFORE the Stripe read: a page that
    // fetched an account it will not render buys a round trip for nothing.
    expect(PAY_SRC.indexOf("if (!partnered) {")).toBeLessThan(
      PAY_SRC.indexOf("await apiGetPaymentAccount("),
    );
    // The BANNER is what branches on the catalogue: a strip for the settled
    // fact, the full PartnerCard box for the state with a decision in it.
    const banner = readFileSync(path.join(__dirname, "./PartnerBanner.tsx"), "utf8");
    expect(banner).toContain("if (!partnered) {");
    expect(banner).toContain("partnered={false}");
    // ONE STATUS NOUN. The strip says what the place IS — Partner —
    // and the only "membership" it may carry is the prop that hands it the
    // subscription. Never a synonym in the copy: the mock's "included with
    // your membership" stays written as partnership (MESITA-1877).
    const bannerCode = stripComments(banner);
    const copy = bannerCode.match(/Product access[^<{]*/)?.[0] ?? "";
    expect(copy).toContain("partnership");
    expect(copy).not.toMatch(/membership/i);
  });
});

// MESITA-1864. Locked used to render a pill and a sentence where the other
// two branches render a control, so the state every new place actually
// meets — Stripe not Ready — was the one that never showed the switch as a
// thing you turn on. MESITA-1867 moved that switch from Partner to Mesita
// Pay; the idiom holds: every branch a track and one line.
//
// MESITA-1891 MADE ONE BRANCH FLIP. `place_profiles.mesita_pay_enabled` has a
// console writer now — `business-web-set-place-rails`, owner-only on that key
// — so the OWNER's Ready branch is a real `<button role="switch">` and every
// other branch is exactly as locked as it was. These pair each live input
// with the input that must NOT be live, so the pair fails the day the branch
// stops discriminating.
describe("the Mesita Pay switch: locked branches show, the owner's flips", () => {
  const pay = (over: Partial<Parameters<typeof MesitaPayCard>[0]> = {}) =>
    renderToStaticMarkup(
      <MesitaPayCard
        placeId="p-1"
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
  /** Every branch that must NOT write: the four the issue names — not
   *  partnered, a failed read, Stripe not charge-ready, insufficient role. */
  const INERT = () => [
    pay({ partnered: false }),
    pay({ partnered: false, mesitaPayEnabled: true }),
    pay({ loadError: "Couldn't load the Stripe account." }),
    ...LOCKED_STATES.map(([accountState]) => pay({ stripeReady: false, accountState })),
    pay({ isOwner: false }),
    pay({ isOwner: false, mesitaPayEnabled: true }),
  ];

  it("every branch renders a track named Mesita Pay — locked included", () => {
    for (const html of [...INERT(), pay(), pay({ mesitaPayEnabled: true })]) {
      expect(html).toContain("h-6 w-11");
      expect(html).toContain('aria-label="Online Payments"');
      expect(html).toContain('role="switch"');
      // The pill is gone: one control, one line, never a third atom.
      expect(html).not.toContain("type-label");
    }
  });

  // THE BIJECTION THIS ISSUE IS ABOUT. Four inert branches against the one
  // live one: every inert branch is `aria-disabled` and is not a button, and
  // the owner's Ready branch is a button and is not `aria-disabled`. Asserting
  // only the live half would pass on a card that let an editor write.
  it("only the owner's Ready branch is operable; every other branch is aria-disabled", () => {
    for (const html of INERT()) {
      expect(html).toContain('aria-disabled="true"');
      expect(html).not.toContain("<button");
    }
    for (const html of [pay(), pay({ mesitaPayEnabled: true })]) {
      expect(html).not.toContain('aria-disabled="true"');
      expect(html).toContain("<button");
      expect(html).toContain('type="button"');
    }
  });

  it("no branch promises a next release any more", () => {
    for (const html of [...INERT(), pay(), pay({ mesitaPayEnabled: true })]) {
      expect(html).not.toContain("next release");
      expect(html).not.toContain("lands with");
    }
  });

  // The control is only as good as the door behind it, and neither the door
  // nor the refresh survives a static render — so the source is the witness,
  // the same way the buy button's form is.
  it("the write is the ONE rails door, and it refreshes the server's copy", () => {
    const code = stripComments(
      readFileSync(path.join(__dirname, "./MesitaPayCard.tsx"), "utf8"),
    );
    // One caller per endpoint: the Capabilities ladder's own server action,
    // never a second one pointed at the same EF.
    expect(code).toContain('from "@/components/place-manage/actions"');
    expect(code).toContain("setPlaceRails(placeId, { mesita_pay: next })");
    // The bit is read server-side by the rail, the catalogue card and this
    // page; without the refresh they disagree until the next navigation.
    expect(code).toContain("router.refresh()");
    // A raw Edge Function string never reaches the DOM.
    expect(code).toContain('railWriteFailure("Online Payments", next)');
    expect(code).toContain("console.error(");
    // And the local copy loses to a fresher server render: the page remounts
    // the card on the bit it was seeded with.
    expect(PAY_SRC).toContain("key={`mesita-pay-${place.mesitaPayEnabled === true}`}");
    expect(PAY_SRC).toContain("placeId={id}");
  });

  it("locked reads off, carries the lock, and names the rung the account is on", () => {
    for (const [accountState, line] of LOCKED_STATES) {
      const html = pay({ stripeReady: false, accountState });
      expect(html, accountState).toContain('aria-checked="false"');
      expect(html, accountState).toContain(line);
      expect(html, accountState).toContain("lucide-lock");
      // The locked thumb does not pretend to lift.
      expect(html, accountState).not.toContain("bg-paper shadow");
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
    expect(failed).not.toContain("bg-paper shadow");
    expect(failed).not.toContain("connect Stripe first");
    expect(read).not.toContain("read the Stripe account");
    expect(read).toContain("bg-paper shadow");
  });

  it("not partnered locks on the subscription, even with the column on (2am test)", () => {
    // A hand-migrated row with `mesita_pay_enabled` on and no subscription
    // must never show a live switch. Same inputs, partnered flipped.
    const orphanRow = pay({ partnered: false, mesitaPayEnabled: true });
    const partner = pay({ mesitaPayEnabled: true });
    expect(orphanRow).toContain("Needs Mesita Partner first.");
    expect(orphanRow).toContain('aria-checked="false"');
    expect(orphanRow).not.toContain("bg-paper shadow");
    expect(partner).not.toContain("Needs Mesita Partner first.");
    expect(partner).toContain('aria-checked="true"');
    expect(partner).toContain("bg-paper shadow");
  });

  it("an editor keeps the live-looking track and the line naming who may move it", () => {
    const owner = pay();
    const editor = pay({ isOwner: false });
    for (const html of [owner, editor]) {
      expect(html).toContain("bg-paper shadow");
      expect(html).not.toContain("lucide-lock");
    }
    // The rank is the only difference, and the line is where it is said.
    expect(editor).toContain("An owner turns this on.");
    expect(owner).not.toContain("An owner turns this on.");
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

// MESITA-1891. The partnered face used to end on "Cancelling from here lands
// with the next release." It lands: one owner-only EF mints a Stripe Billing
// Portal session and the console links to it, so Mesita writes no
// cancellation logic at all — the webhook already mirrors what comes back.
describe("the way out of a Membership is Stripe's own portal", () => {
  const PORTAL_SRC = stripComments(
    readFileSync(path.join(__dirname, "./PartnerCard.tsx"), "utf8"),
  );
  const BANNER_SRC = stripComments(
    readFileSync(path.join(__dirname, "./PartnerBanner.tsx"), "utf8"),
  );
  const manage = (isOwner: boolean) =>
    renderToStaticMarkup(<ManageMembership placeId="p-1" isOwner={isOwner} />);

  it("nothing in the console still promises the cancel", () => {
    for (const src of [PORTAL_SRC, BANNER_SRC, PAGE_SRC]) {
      expect(src).not.toContain("next release");
    }
  });

  it("the owner gets the door; everyone else reads who has it — the bijection", () => {
    const owner = manage(true);
    const editor = manage(false);
    expect(owner).toContain("Manage membership");
    expect(owner).toContain("<form");
    expect(owner).toContain('name="placeId"');
    expect(owner).not.toContain("An owner manages the membership.");
    expect(editor).toContain("An owner manages the membership.");
    expect(editor).not.toContain("Manage membership");
    expect(editor).not.toContain("<form");
  });

  it("a form and a redirect, disabled while the session is minted", () => {
    const code = PORTAL_SRC.slice(PORTAL_SRC.indexOf("export function ManageMembership"));
    // A server action that redirects to Stripe only redirects from a form
    // submit, never from an onClick handler.
    expect(code).toContain("<form action={action}");
    expect(code).toContain("manageMembershipAction");
    expect(code).toContain("disabled={pending}");
  });

  // The strip is the partnered face an operator actually meets: products/page
  // renders PartnerBanner, and PartnerBanner renders PartnerCard only for a
  // NON-partner. A door only on the card would be a door nobody can reach.
  it("the door is on the strip a partner actually lands on", () => {
    expect(BANNER_SRC).toContain("<ManageMembership");
    expect(PORTAL_SRC).toContain("<ManageMembership");
  });
});
