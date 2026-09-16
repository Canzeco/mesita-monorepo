// The catalogue cannot lie about a product (MESITA-1869).
//
// Eight cards is eight chances to assert something nobody read. Every test
// here is a BIJECTION — the state under one input, asserted against its
// opposite under the other — because "a locked product shows no Enable
// button" passes trivially for a builder that returns nothing.
//
// ONE PLACE, NOT A PORTFOLIO (MESITA-1892). The catalogue was the
// ORGANIZATION's, so a per-place card printed a COUNT over everything it
// held. The organization is gone and the catalogue is `/places/<id>/products`,
// so the same facts read as a state about this place — and the rule the
// counts existed to hold is unchanged and asserted below: a read that FAILED
// prints nothing at all.
import { describe, expect, it } from "vitest";
import type { ConsolePlace } from "@/lib/api/console";
import { PRODUCT_KEYS } from "@/components/console/ProductCatalog";
import { PRODUCT_ORDER, buildProductCards } from "./products";
import { PLACE_TABS, placeTabHref, type PlaceTab } from "./place-tabs";
import { RAIL_ROWS, placePayHref } from "./console-routes";
import {
  PRODUCT_KEYS as VOCABULARY_KEYS,
  type ProductKey,
} from "@/lib/product-keys";

/** The caller's own shape: a view in, an address out. The page builds this
 *  from the place it is about; the test builds it from a fixed id. */
const HREF = (view: (typeof PLACE_TABS)[number]) => placeTabHref("p-1", view);
const PAY = placePayHref("p-1");

function place(over: Partial<ConsolePlace> = {}): ConsolePlace {
  return {
    id: "p-1",
    name: "Strana",
    address: null,
    zone: null,
    claimedAt: null,
    ...over,
  };
}

function build(over: Partial<Parameters<typeof buildProductCards>[0]> = {}) {
  const cards = buildProductCards({
    partnered: false,
    mesitaPayEnabled: false,
    place: place(),
    placeHref: HREF,
    payHref: PAY,
    ...over,
  });
  return Object.fromEntries(cards.map((c) => [c.key, c]));
}

describe("the catalogue is the whole catalogue, in one order", () => {
  it("draws every product the component knows, and no other", () => {
    // A key in one list and not the other is a card with no mark, or a mark
    // with no card — and the second renders `undefined` straight into a
    // className. The bijection is the assertion, in both directions.
    expect([...PRODUCT_ORDER].sort()).toEqual([...PRODUCT_KEYS].sort());
    expect(PRODUCT_ORDER).toHaveLength(9);
  });

  it("is Pato's list, and the RAIL prints the same order (MESITA-1929)", () => {
    // Pato, 2026-09-16: "Profile / Costumers // Visits / Orders /
    // Reservations // Rewards / Payments / Credits", written as three groups
    // with a blank line between them.
    //
    // WHERE REWARDS SITS IS THE ARGUMENT, and it reversed (MESITA-1928).
    // MESITA-1900 filed it with money — "beside Payments and Credits, not at
    // the table beside Visits" — and Pato moved it back to the table: a reward
    // is earned by closing a bill AT A TABLE and by nothing else, since an
    // order is prepaid and has none.
    //
    // CAPITAL IS NINTH (MESITA-1929): "where is Capital, include Capital
    // there". It is money and it is not built, so it is last and it is Soon.
    expect(PRODUCT_ORDER).toEqual([
      "profile",
      "customers",
      "visits",
      "rewards",
      "orders",
      "reservations",
      "pay",
      "credits",
      "capital",
    ]);
    // AND THE RAIL PRINTS THAT SAME ORDER. Two arrays, one story: `SPECS`
    // carries card copy and `RAIL_ROWS` carries rows, and MESITA-1928 moved
    // one without the other — for a commit the console answered "where does
    // Rewards belong" two different ways. This is the assertion that would
    // have caught it.
    expect(
      RAIL_ROWS.filter((r) => r.kind === "product").map((r) => r.product),
    ).toEqual(PRODUCT_ORDER);
    expect(PRODUCT_ORDER).not.toContain("terminal");
    expect(PRODUCT_KEYS).not.toContain("terminal");
  });

  it("there is ONE vocabulary, and the grid re-exports it (MESITA-1900)", () => {
    // `ProductCatalog.tsx` held a second `PRODUCT_KEYS` of its own after
    // MESITA-1885 split the vocabulary out, so the list existed twice and
    // each reader picked one. This import comes from the COMPONENT and the
    // one below from the split file; same array identity or they are two
    // lists again.
    expect(PRODUCT_KEYS).toBe(VOCABULARY_KEYS);
  });

  it("renders all eight in EVERY state, so no read can hide a product", () => {
    // A catalogue is also a price list: a product this place has not bought is
    // exactly the one it most needs to see. A filter hides it; a failed read
    // must not.
    for (const input of [
      {},
      { partnered: true },
      { place: null },
      { partnered: true, mesitaPayEnabled: true },
    ]) {
      expect(Object.keys(build(input))).toHaveLength(9);
    }
  });

  it("EVERY product with a verb is a real place view, by its own name", () => {
    // `PRODUCT_VIEW` is deleted (MESITA-1885). It was a hand-written
    // `Record<ProductKey, PlaceTab>` back when six products pointed at two
    // shared pages; the rooms split per product, so the map became the
    // identity — and an identity written out by hand is a second place for a
    // spelling to drift.
    //
    // THIS IS THE ASSERTION THAT REPLACES IT, and it is the set equality the
    // cast `key as PlaceTab` in `products.ts` relies on. The two that are NOT
    // place views are exactly the two that carry no verb, in both directions:
    // a product losing its view without losing its verb would 404 an operator
    // from the catalogue.
    // Customers is the ONLY one since MESITA-1900 retired Terminal.
    //
    // THE BIJECTION IS OVER BUILT PRODUCTS (MESITA-1929). `products.ts` gives a
    // Soon card `action: null` unconditionally — "a soon card cannot be locked,
    // cannot be off, and must never be counted" — so Capital carries a page and
    // no verb, and that is not the failure this test hunts. The failure is a
    // verb pointing at a view that does not exist, which would 404 an operator
    // out of the catalogue; a card with NO verb cannot 404 anyone. So a Soon
    // card is asserted to be verbless and then left alone, and the two-way
    // check runs over the products that are actually built.
    const noView: readonly ProductKey[] = ["customers"];
    const cards = build({ partnered: true });
    for (const key of PRODUCT_ORDER) {
      if (cards[key].state === "soon") {
        expect(cards[key].action, key).toBeNull();
        continue;
      }
      if (noView.includes(key)) {
        expect(cards[key].action, key).toBeNull();
        expect(PLACE_TABS, key).not.toContain(key);
      } else {
        expect(PLACE_TABS, key).toContain(key);
        expect(cards[key].action, key).not.toBeNull();
      }
    }
  });

  it("sends a per-place verb to the view that HOLDS its switch — its OWN", () => {
    // The bug this replaces: every per-place card pointed at the place root,
    // so an operator clicking Enable on Orders landed on Profile, a screen
    // holding none of its switches (MESITA-1879).
    //
    // THREE OF THEM USED TO SHARE ONE ADDRESS. Orders, Reservations and
    // Credits all opened `capabilities` — one screen, three verbs, and the
    // operator left to find which row was theirs. MESITA-1885 split the rooms
    // to match the rail, so each card opens the view of its own name.
    const cards = build({ partnered: true });
    expect(cards.orders.action?.href).toBe(placeTabHref("p-1", "orders"));
    expect(cards.reservations.action?.href).toBe(
      placeTabHref("p-1", "reservations"),
    );
    expect(cards.credits.action?.href).toBe(placeTabHref("p-1", "credits"));
    expect(cards.visits.action?.href).toBe(placeTabHref("p-1", "visits"));

    // NO TWO CARDS SHARE A DOOR, which is the assertion the old shape could
    // not make — and the reason the rail could not list all eight before.
    const doors = Object.values(cards)
      .map((c) => c.action?.href)
      .filter((h): h is string => Boolean(h));
    expect(doors).toHaveLength(new Set(doors).size);

    // And the opposite direction: no per-place verb may land on the bare
    // place root, which is what "points at Profile" looked like.
    for (const key of ["orders", "reservations", "credits", "visits"]) {
      expect(cards[key].action?.href).not.toBe("/places/p-1");
      expect(cards[key].action?.href).not.toBe(placeTabHref("p-1", "profile"));
    }
  });

  it("every card names itself Mesita, and says one thing", () => {
    for (const card of Object.values(build())) {
      expect(card.name.startsWith("Mesita ")).toBe(true);
      expect(card.blurb.endsWith(".")).toBe(true);
    }
  });
});

describe("Mesita Profile is free, and is the only card that says so", () => {
  // Pato: "remember that profile is free."
  it("is on with no switch, in every state, and never reads Not enabled", () => {
    for (const input of [{}, { partnered: true }, { place: null }]) {
      const profile = build(input).profile;
      expect(profile.state).toBe("free");
      expect(profile.note).toContain("Always free");
      // It still has a verb: the profile is the thing you go and edit.
      expect(profile.action).toEqual({
        label: "Manage",
        href: placeTabHref("p-1", "profile"),
      });
    }
  });

  it("is the only card wearing the FREE state — Customers says free and is Soon", () => {
    // Pato listed both as free ("Profile (Free) / Costumers (Free)"), and
    // only one of them is built. Free is a PRICE; the chip reports whether
    // the engine exists. Customers says the price in its note and wears Soon,
    // because a green chip on an empty page is the lie SoonStrip's law names.
    const cards = Object.values(build({ partnered: true }));
    expect(cards.filter((c) => c.state === "free").map((c) => c.key)).toEqual([
      "profile",
    ]);
    expect(build({ partnered: true }).customers.state).toBe("soon");
    expect(build({ partnered: true }).customers.note).toContain("Always free");
    for (const c of cards) {
      if (c.key === "profile" || c.key === "customers") continue;
      expect(c.note ?? "", c.key).not.toMatch(/\bfree\b/i);
    }
  });
});

describe("partner-gated products lock, and the lock is not an off switch", () => {
  const GATED = ["visits", "pay", "credits"] as const;

  it("read Locked with the prerequisite, and offer NO verb, without the partnership", () => {
    const cards = build({ partnered: false, place: place({ credits: true }) });
    for (const key of GATED) {
      expect(cards[key].state, key).toBe("locked");
      expect(cards[key].note, key).toBe("Needs Mesita Partner.");
      // An Enable button here would walk an operator to a switch they cannot
      // move — the fault the Capabilities ladder exists to prevent.
      expect(cards[key].action, key).toBeNull();
    }
    // Even with the column ON: the subscription is the gate, and a place
    // whose `credits_enabled` survived a lapsed partnership must not read as
    // a live product.
    expect(cards.credits.state).toBe("locked");
  });

  it("unlock the moment the place partners — the same three", () => {
    const cards = build({ partnered: true });
    for (const key of GATED) {
      expect(cards[key].state, key).not.toBe("locked");
      expect(cards[key].note ?? "", key).not.toContain("Needs Mesita Partner");
    }
  });

  it("the ungated three never lock, partnered or not", () => {
    for (const partnered of [true, false]) {
      const cards = build({ partnered });
      for (const key of ["profile", "orders", "reservations"] as const) {
        expect(cards[key].state, `${key}/${partnered}`).not.toBe("locked");
      }
    }
  });
});

describe("a state is READ, and a failed read prints nothing (MESITA-1892)", () => {
  it("says on or not on, per column, for THIS place", () => {
    // Orders is ONE card over TWO columns, so each one alone turns it on.
    const pickup = build({ partnered: true, place: place({ pickupOrders: true }) });
    expect(pickup.orders.state).toBe("enabled");
    expect(pickup.orders.note).toBe("On here.");
    const delivery = build({
      partnered: true,
      place: place({ deliveryOrders: true }),
    });
    expect(delivery.orders.state).toBe("enabled");

    const off = build({ partnered: true, place: place() });
    expect(off.orders.state).toBe("off");
    expect(off.orders.note).toBe("Not on here yet.");
    expect(off.reservations.note).toBe("Not on here yet.");

    const on = build({
      partnered: true,
      place: place({ reservations: true, credits: true }),
    });
    expect(on.reservations.note).toBe("On here.");
    expect(on.credits.note).toBe("On here.");
  });

  it("A FAILED READ IS NOT AN OFF — the note is dropped, never fabricated", () => {
    // `place: null` is the read that threw. "Not on here yet" is the most
    // believable lie this screen could tell, which is exactly why the builder
    // must refuse to tell it (SoonStrip's law). The STATE still falls to
    // `off`, because a card has to render something and a false "on" would be
    // the worse half of the pair — but nothing asserts it in words.
    const failed = build({ partnered: true, place: null });
    for (const key of ["orders", "reservations", "credits"] as const) {
      expect(failed[key].note, key).toBeNull();
      expect(failed[key].state, key).toBe("off");
    }
  });
});

describe("a verb names the screen it opens", () => {
  it("says Manage or Enable, and never a third word", () => {
    // `Add a place` LEFT (MESITA-1892). It was the label a card wore while the
    // ORGANIZATION held no place and every verb landed on the Add ceremony;
    // this catalogue is one place's, so a page that renders at all has one.
    const cards = build({ partnered: true, place: place({ reservations: true }) });
    expect(cards.profile.action?.label).toBe("Manage");
    expect(cards.reservations.action?.label).toBe("Manage");
    expect(cards.orders.action?.label).toBe("Enable");
    for (const c of Object.values(cards)) {
      if (!c.action) continue;
      expect(["Manage", "Enable", "Set up"], c.key).toContain(c.action.label);
    }
  });
});

describe("Mesita Pay's verb is the one that stays on this page", () => {
  it("reads the place's own column, and points at the setup sub-step", () => {
    const on = build({ partnered: true, mesitaPayEnabled: true });
    expect(on.pay.state).toBe("enabled");
    expect(on.pay.action).toEqual({ label: "Manage", href: PAY });
    expect(on.pay.note).toBe("On here. Guests can pay by card.");
    const off = build({ partnered: true, mesitaPayEnabled: false });
    expect(off.pay.state).toBe("off");
    expect(off.pay.action).toEqual({ label: "Set up", href: PAY });
    expect(off.pay.note).toBe("Set up this place's Stripe account first.");
  });

  it("is the ONLY product whose verb leaves the place's views behind", () => {
    // Every other verb lands on a VIEW — its own now (MESITA-1879), not the
    // place root every one of them shared before.
    const cards = Object.values(build({ partnered: true }));
    for (const c of cards) {
      if (!c.action) continue;
      expect(c.action.href, c.key).toBe(
        c.key === "pay" ? PAY : placeTabHref("p-1", c.key as PlaceTab),
      );
    }
  });
});

describe("Soon is Customers ALONE (MESITA-1900)", () => {
  it("shares Soon with NOTHING that has a column", () => {
    // The set is closed on purpose. Every other card reads a column or a
    // subscription, and a card with a real fact behind it that paints Soon is
    // a product quietly withdrawn from sale by a typo.
    //
    // Terminal was the other member and left with the product. `spec.soon`
    // stays a FIELD rather than collapsing back to `key === "customers"`: it
    // was that hardcode once, and MESITA-1884 had to undo it the moment a
    // second product was unbuilt.
    // CAPITAL JOINED IT (MESITA-1929), which is exactly what the paragraph
    // above predicted would happen: `spec.soon` stayed a field so a second
    // unbuilt product would cost one line here instead of a rewrite.
    const cards = Object.values(build({ partnered: true }));
    expect(cards.filter((c) => c.state === "soon").map((c) => c.key)).toEqual([
      "customers",
      "capital",
    ]);
  });
});

describe("Mesita Customers is free, unbuilt, and says both (MESITA-1884)", () => {
  // Pato wrote it "Costumers (Free)". The engine is not built —
  // `/places/<id>/customers` is a SoonStrip page — so the two facts split: the
  // chip carries the harder one, the note carries the price.
  it("is Soon in every state, with no verb and no count", () => {
    for (const input of [{}, { partnered: true }, { place: null }]) {
      const c = build(input).customers;
      expect(c.state, JSON.stringify(input)).toBe("soon");
      // No verb: Customers already has its own rail row, so the door exists
      // and a second one on an empty page is a click that teaches nothing.
      expect(c.action).toBeNull();
      expect(c.note).toBe("Always free. Nothing is live yet.");
    }
  });

  it("is NOT partner-gated — a free product may never read Locked", () => {
    // The bijection against the gated three: no subscription can deliver a
    // product that does not exist, so `soon` has to outrank the partner gate.
    expect(build({ partnered: false }).customers.state).toBe("soon");
    expect(build({ partnered: true }).customers.state).toBe("soon");
  });
});

describe("Visits and Rewards are two cards, and neither borrows (MESITA-1900)", () => {
  // Pato, 2026-09-16, separated what MESITA-1884 merged on *"should i separate
  // visits and rewards into two?? i don't think so."*
  //
  // THE TRAP IS THE SAME ONE, AND THE SPLIT IS WHAT DISARMS IT. MESITA-1882
  // fixed a Rewards card that claimed Enabled at strategy Zero — 0% to every
  // guest, no Partner badge in the guest app, reported as "on" by the one
  // screen whose job is saying what is on. MESITA-1884 then refused to give
  // VISITS' card the dial's state, because that lies the other way: a partner
  // whose checkout works — guests scan, the bill closes, money moves — would
  // have read "Not enabled" because the discount is zero.
  //
  // Two cards, two states, neither borrowed. Visits' state is the container's
  // and Rewards' is `visitRewards`, where "Not on here yet" is the dial's own
  // truth and accuses nothing. Every test below is the bijection between
  // them.

  it("stays Enabled for a partner whose rewards are at Zero", () => {
    // The card must NOT move with the dial. This is the assertion that fails
    // if anyone "simplifies" Visits into the per-place branch.
    const zero = build({
      partnered: true,
      place: place({ visitRewards: false }),
    }).visits;
    expect(zero.state).toBe("enabled");
    expect(zero.action?.label).toBe("Manage");
  });

  it("is on for a partner no matter what the place says", () => {
    // There is no `visits_enabled` column anywhere — two other tests assert
    // its absence — so no per-place fact may move this card.
    for (const p of [
      place(),
      place({ visitRewards: false }),
      place({ visitRewards: true }),
      null,
    ]) {
      const visits = build({ partnered: true, place: p }).visits;
      expect(visits.state, JSON.stringify(p)).toBe("enabled");
    }
  });

  it("but the partnership still gates it — on is not unconditional", () => {
    // The bijection against the test above: same card, no partnership.
    expect(build({ partnered: false }).visits.state).toBe("locked");
  });

  it("REWARDS' card moves with the dial, which is the other half", () => {
    // The bijection MESITA-1884 could not have: the same two reads that must
    // NOT move Visits must move Rewards, or the split bought nothing and the
    // dial is once again a fact with no card of its own.
    const zero = build({
      partnered: true,
      place: place({ visitRewards: false }),
    }).rewards;
    const on = build({
      partnered: true,
      place: place({ visitRewards: true }),
    }).rewards;

    expect(zero.state).toBe("off");
    expect(on.state).toBe("enabled");
    expect(zero.action?.href).toBe(placeTabHref("p-1", "rewards"));
  });

  it("Rewards is Partner-gated, and reads Locked rather than Off", () => {
    // Conservative and Aggressive are what the Membership prices, so a
    // non-partner has no switch to be walked to — the ladder grammar every
    // partner-gated card on this page uses.
    const card = build({ partnered: false, place: place({ visitRewards: true }) })
      .rewards;
    expect(card.state).toBe("locked");
    expect(card.action).toBeNull();
  });

  it("VISITS' note is one sentence again, and names no dial", () => {
    // The rewards clause rode this note from MESITA-1884 until the split. A
    // note reporting another product's dial would be the second place that
    // fact lives, which is the drift every comment in `products.ts` is about.
    for (const p of [place({ visitRewards: false }), place({ visitRewards: true }), null]) {
      const visits = build({ partnered: true, place: p }).visits;
      expect(visits.note, JSON.stringify(p)).toBe("Included with Mesita Partner.");
      expect(visits.note).not.toMatch(/rewards/i);
    }
  });

  it("A FAILED READ FABRICATES NO REWARDS STATE", () => {
    // The rule the whole file exists to hold, now applied to the card that
    // actually reads the column: `place: null` is a read that FAILED, and Off
    // is the most believable fabrication there is.
    const rewards = build({ partnered: true, place: null }).rewards;
    expect(rewards.note).toBeNull();
  });

  it("never promises cashback — nothing accumulates on Mesita", () => {
    // `_shared/memo-knowledge.ts` id "no-cashback": a reward is a discount on
    // tonight's bill. `cashback_ledger` is a dropped table. The word left
    // with MESITA-1882's blurb and must not return through the merge.
    for (const card of Object.values(build({ partnered: true }))) {
      expect(card.blurb.toLowerCase(), card.key).not.toContain("cashback");
      expect((card.note ?? "").toLowerCase(), card.key).not.toContain("cashback");
    }
  });
});
