// The catalogue cannot lie about a product (MESITA-1869).
//
// Eight cards is eight chances to assert something nobody read. Every test
// here is a BIJECTION — the state under one input, asserted against its
// opposite under the other — because "a locked product shows no Enable
// button" passes trivially for a builder that returns nothing.
import { describe, expect, it } from "vitest";
import type { ConsolePlace } from "@/lib/api/organizations";
import { PRODUCT_KEYS } from "@/components/console/ProductCatalog";
import { PRODUCT_ORDER, PRODUCT_VIEW, buildProductCards } from "./products";
import { PLACE_TABS, placeTabHref } from "./place-tabs";

/** The caller's own shape: a view in, an address out. The page builds this
 *  from the one place it holds; the test builds it from a fixed id. */
const HREF = (view: (typeof PLACE_TABS)[number]) => placeTabHref("p-1", view);
const PAY = "/orgs/org-1/products#mesita-pay";

function place(over: Partial<ConsolePlace> = {}): ConsolePlace {
  return {
    id: "p-1",
    name: "Strana",
    address: null,
    zone: null,
    organizationId: "org-1",
    claimedAt: null,
    ...over,
  };
}

function build(over: Partial<Parameters<typeof buildProductCards>[0]> = {}) {
  const cards = buildProductCards({
    partnered: false,
    mesitaPayEnabled: false,
    places: [],
    placeHref: HREF,
    noPlaces: false,
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
    expect(PRODUCT_ORDER).toHaveLength(8);
  });

  it("renders all eight in EVERY state, so no read can hide a product", () => {
    // A catalogue is also a price list: a product an organization has not
    // bought is exactly the one it most needs to see. A filter hides it; a
    // failed read must not.
    for (const input of [
      {},
      { partnered: true },
      { places: null },
      { partnered: true, mesitaPayEnabled: true, places: [place()] },
    ]) {
      expect(Object.keys(build(input))).toHaveLength(8);
    }
  });

  it("maps EVERY product to a real place view, and to a live one", () => {
    // PRODUCT_VIEW is hand-written because no derivation exists across
    // ProductKey and LadderRowKey (they share one spelling and mean different
    // things by it). Hand-written means a new product can be added without
    // one, so the exhaustiveness is the assertion — in both directions.
    expect(Object.keys(PRODUCT_VIEW).sort()).toEqual([...PRODUCT_ORDER].sort());
    for (const view of Object.values(PRODUCT_VIEW)) {
      expect(PLACE_TABS).toContain(view);
    }
  });

  it("sends a per-place verb to the view that HOLDS its switch", () => {
    // The bug this replaces: every per-place card pointed at the place root,
    // so an operator clicking Enable on Orders landed on Profile, a screen
    // holding none of its switches. Capabilities and Rewards lost their rail
    // rows in MESITA-1879, which makes these verbs their only door.
    const cards = build({ partnered: true, places: [place()] });
    expect(cards.orders.action?.href).toBe(placeTabHref("p-1", "capabilities"));
    expect(cards.reservations.action?.href).toBe(
      placeTabHref("p-1", "capabilities"),
    );
    expect(cards.credits.action?.href).toBe(placeTabHref("p-1", "capabilities"));
    expect(cards.rewards.action?.href).toBe(placeTabHref("p-1", "rewards"));
    expect(cards.visits.action?.href).toBe(placeTabHref("p-1", "rewards"));
    // And the opposite direction: no per-place verb may land on the bare
    // place root, which is what "points at Profile" looked like.
    for (const key of ["orders", "reservations", "credits", "rewards", "visits"]) {
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
    for (const input of [{}, { partnered: true }, { places: null }]) {
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

  it("no OTHER card claims to be free", () => {
    const cards = Object.values(build({ partnered: true }));
    expect(cards.filter((c) => c.state === "free")).toHaveLength(1);
    for (const c of cards) {
      if (c.key === "profile") continue;
      expect(c.note ?? "", c.key).not.toMatch(/\bfree\b/i);
    }
  });
});

describe("partner-gated products lock, and the lock is not an off switch", () => {
  const GATED = ["visits", "rewards", "pay", "credits"] as const;

  it("read Locked with the prerequisite, and offer NO verb, without the partnership", () => {
    const cards = build({ partnered: false, places: [place({ credits: true })] });
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

  it("unlock the moment the organization partners — the same four", () => {
    const cards = build({ partnered: true, places: [place()] });
    for (const key of GATED) {
      expect(cards[key].state, key).not.toBe("locked");
      expect(cards[key].note ?? "", key).not.toContain("Needs Mesita Partner");
    }
  });

  it("the ungated three never lock, partnered or not", () => {
    for (const partnered of [true, false]) {
      const cards = build({ partnered, places: [place()] });
      for (const key of ["profile", "orders", "reservations"] as const) {
        expect(cards[key].state, `${key}/${partnered}`).not.toBe("locked");
      }
    }
  });
});

describe("a count is READ, and a failed read prints no number", () => {
  const PLACES = [
    place({ id: "a", pickupOrders: true, credits: true }),
    place({ id: "b", deliveryOrders: true }),
    place({ id: "c", reservations: true }),
  ];

  it("counts the places whose column is on, and says how many of how many", () => {
    const cards = build({ partnered: true, places: PLACES });
    // Orders is ONE card over TWO columns: pickup at a, delivery at b.
    expect(cards.orders.state).toBe("enabled");
    expect(cards.orders.note).toBe("On at 2 of 3 places.");
    expect(cards.reservations.note).toBe("On at 1 of 3 places.");
    expect(cards.credits.note).toBe("On at 1 of 3 places.");
  });

  it("all-on and none-on are different sentences, and neither is a fraction", () => {
    const allOn = build({
      partnered: true,
      places: [place({ id: "a", reservations: true }), place({ id: "b", reservations: true })],
    });
    expect(allOn.reservations.state).toBe("enabled");
    expect(allOn.reservations.note).toBe("On at all 2 places.");
    const noneOn = build({ partnered: true, places: PLACES });
    expect(noneOn.reservations.state).toBe("enabled");
    const off = build({ partnered: true, places: [place({ id: "a" })] });
    expect(off.reservations.state).toBe("off");
    expect(off.reservations.note).toBe("Off at all 1 place.");
  });

  it("A FAILED READ IS NOT A ZERO — the note is dropped, never fabricated", () => {
    // `places: null` is the read that threw. "On at 0 of 0 places" is the
    // most believable lie this screen could tell, which is exactly why the
    // builder must refuse to tell it (SoonStrip's law).
    const failed = build({ partnered: true, places: null });
    for (const key of ["orders", "reservations", "credits"] as const) {
      expect(failed[key].note, key).toBeNull();
      expect(failed[key].state, key).toBe("off");
    }
    // And an organization that genuinely holds nothing SAYS so — the two are
    // different facts and must not collapse into one sentence.
    const empty = build({ partnered: true, places: [] });
    expect(empty.orders.note).toBe("No places yet.");
  });
});

describe("a verb names the screen it opens", () => {
  it("says Add a place when the organization holds none, whatever the state", () => {
    // `placeHome` is the Add ceremony then, and "Enable" on a button that
    // opens Add place is a promise the next screen does not keep.
    const cards = build({ partnered: true, places: [], noPlaces: true });
    for (const c of Object.values(cards)) {
      if (!c.action || c.key === "pay") continue;
      expect(c.action.label, c.key).toBe("Add a place");
    }
    // Mesita Pay is the exception BECAUSE it is the exception: its verb never
    // lands on a place, so having none changes nothing about it.
    expect(cards.pay.action?.label).toBe("Set up");
  });

  it("says Manage or Enable the moment a place exists", () => {
    const cards = build({
      partnered: true,
      places: [place({ reservations: true })],
      noPlaces: false,
    });
    expect(cards.profile.action?.label).toBe("Manage");
    expect(cards.reservations.action?.label).toBe("Manage");
    expect(cards.orders.action?.label).toBe("Enable");
  });
});

describe("Mesita Pay is the one switch at this level", () => {
  it("reads the ORG column, and points at the box on its own page", () => {
    const on = build({ partnered: true, mesitaPayEnabled: true });
    expect(on.pay.state).toBe("enabled");
    expect(on.pay.action).toEqual({ label: "Manage", href: PAY });
    const off = build({ partnered: true, mesitaPayEnabled: false });
    expect(off.pay.state).toBe("off");
    expect(off.pay.action).toEqual({ label: "Set up", href: PAY });
  });

  it("is the ONLY product whose verb leaves the place behind", () => {
    // Every other verb lands on a PLACE address — its own view now
    // (MESITA-1879), not the place root every one of them shared before.
    const cards = Object.values(build({ partnered: true, places: [place()] }));
    for (const c of cards) {
      if (!c.action) continue;
      expect(c.action.href, c.key).toBe(
        c.key === "pay" ? PAY : placeTabHref("p-1", PRODUCT_VIEW[c.key]),
      );
    }
  });
});

describe("Mesita Terminal is honest about not existing", () => {
  it("is Soon in every state, with no verb and no count", () => {
    for (const input of [{}, { partnered: true, places: [place()] }, { places: null }]) {
      const t = build(input).terminal;
      expect(t.state).toBe("soon");
      expect(t.action).toBeNull();
      expect(t.note).toContain("not available yet");
    }
  });

  it("is the only Soon — a card with a real column must never claim one", () => {
    const cards = Object.values(build({ partnered: true, places: [place()] }));
    expect(cards.filter((c) => c.state === "soon").map((c) => c.key)).toEqual([
      "terminal",
    ]);
  });
});
