import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LADDER_ZONES,
  PLACE_NOT_PARTNERED,
  ZONE_ROWS,
  guestSummary,
  ladderScoreMatchesPromotionScore,
  offeringRows,
  paintRows,
  rejoinFailure,
  rowsForZone,
  tierFlag,
  topPrerequisite,
  type LadderInput,
} from "./offerings";

const BASE: LadderInput = {
  member: true,
  visitRewardsLevel: 0,
  rails: {
    mesita_pay: false,
    credits: false,
    pickup: false,
    delivery: false,
    reservations: null,
  },
  connect: { kind: "none" },
};

function stripeRow(input: LadderInput) {
  const row = offeringRows(input).find((r) => r.key === "stripe");
  if (!row) throw new Error("no stripe row");
  return row;
}

describe("the stripe rung's copy — whose account it is (MESITA-1684)", () => {
  it("says THIS PLACE owns the account (MESITA-1892)", () => {
    // MESITA-1684 made this line say "your organization owns the account",
    // because `organization_payment_accounts` was one row per organization
    // and every place it held shared it — the copy before that claimed the
    // place owned it, which was simply wrong. `place_payment_accounts` is one
    // row per PLACE now, so the original sentence is finally true and this
    // assertion flips with the column.
    const row = stripeRow(BASE);
    expect(row.detail).toContain("This place owns the account");
    expect(row.detail).not.toContain("organization");
  });

  it("still names a place-relevant consequence when Stripe needs more detail", () => {
    const row = stripeRow({
      ...BASE,
      connect: { kind: "incomplete", requirementsDue: ["individual.id_number"] },
    });
    expect(row.detail).toContain("this place can be paid");
  });
});

// ── MESITA-1735 ───────────────────────────────────────────────────────────

function rowFor(input: LadderInput, key: string) {
  const row = offeringRows(input).find((r) => r.key === key);
  if (!row) throw new Error(`no ${key} row`);
  return row;
}

describe("T5 — the console must not disagree with the consumer app", () => {
  // web-consumer's `isReserveActionEnabled` is exactly
  // `row?.reservations_enabled === true`
  // (apps/web-consumer/src/lib/place-profile-actions.ts). Two packages, two
  // install roots, so the predicate is restated here as a literal rather than
  // imported — and THAT is the thing under test. The console used to answer
  // this question with a hard-coded `{ kind: "off" }` while the consumer app
  // rendered a live Reserve CTA off the same column.
  const consumerSays = (reservationsEnabled: boolean | null) =>
    reservationsEnabled === true;

  for (const value of [true, false, null] as const) {
    it(`agrees for reservations_enabled = ${String(value)}`, () => {
      const row = rowFor({ ...BASE, rails: { ...BASE.rails, reservations: value } }, "reservations");
      if (row.state.kind !== "not_mine") {
        throw new Error(`expected not_mine, got ${row.state.kind}`);
      }
      // null stays null — the row says Unknown, and Unknown is not a claim
      // that the place takes no bookings.
      expect(row.state.on).toBe(value);
      if (value !== null) expect(row.state.on === true).toBe(consumerSays(value));
    });
  }

  it("never renders a switch for reservations — nothing writes it from here", () => {
    const row = rowFor({ ...BASE, rails: { ...BASE.rails, reservations: true } }, "reservations");
    expect(row.state.kind).toBe("not_mine");
    // _shared/place-rails.ts RAIL_COLUMNS = {mesita_pay, credits, pickup,
    // delivery}. A switch here would post a key the EF loop skips: 200 OK,
    // no write, and an optimistic UI showing it on.
    expect(["on", "off"]).not.toContain(row.state.kind);
  });
});

describe("T4 — a read in flight is not a verdict", () => {
  it("Stripe and Mesita Pay read Checking, never locked, while connect loads", () => {
    // placeMesitaPay is KNOWN on here, so the Connect read alone decides.
    const input: LadderInput = { ...BASE, connectLoading: true, placeMesitaPay: true };
    expect(rowFor(input, "stripe").state.kind).toBe("checking");
    expect(rowFor(input, "mesita_pay").state.kind).toBe("checking");
  });

  it("a non-member still reads locked while loading — partnership outranks it", () => {
    const input: LadderInput = { ...BASE, member: false, connectLoading: true };
    expect(rowFor(input, "stripe").state.kind).toBe("locked");
  });

  it("falls through to the real verdict once the read lands", () => {
    const input: LadderInput = { ...BASE, connect: { kind: "ready" }, connectLoading: false };
    expect(rowFor(input, "stripe").state.kind).toBe("on");
  });
});

describe("T3 — an unread fact is never rendered as false", () => {
  it("reservations reports Unknown, not Off, when the payload omitted it", () => {
    const row = rowFor({ ...BASE, rails: { ...BASE.rails, reservations: null } }, "reservations");
    if (row.state.kind !== "not_mine") throw new Error("expected not_mine");
    expect(row.state.on).toBeNull();
  });
});

describe("first paint — what guests can do, not a zero (MESITA-1739)", () => {
  it("names the live reservation and says nothing else is live", () => {
    const rows = offeringRows({
      ...BASE,
      rails: { ...BASE.rails, reservations: true },
    });
    expect(guestSummary(rows)).toBe(
      "Right now, guests can book a table. Nothing else is live.",
    );
  });

  it("says nothing is live when every guest rail is off", () => {
    expect(guestSummary(offeringRows(BASE))).toBe(
      "Right now, nothing is live for guests.",
    );
  });

  it("drops partnership and stripe from the painted list", () => {
    const keys = paintRows(offeringRows(BASE)).map((r) => r.key);
    expect(keys).not.toContain("partnership");
    expect(keys).not.toContain("stripe");
  });

  it("sorts a disagreement above rows that agree", () => {
    const rows = paintRows(
      offeringRows({
        ...BASE,
        member: false,
        visitRewardsLevel: 2,
        rails: { ...BASE.rails, reservations: true },
      }),
    );
    expect(rows[0].key).toBe("visit_rewards");
    expect(rows[0].disagreement).not.toBeNull();
  });

  it("sends a non-partner whose place is not partnered to subscribe in Products", () => {
    const prereq = topPrerequisite({ ...BASE, member: false, placePartnered: false });
    expect(prereq?.action).toBe("setup");
    expect(prereq?.text).toContain("Mesita Partner");
    // The partnership is a yearly subscription now (MESITA-1867). The line
    // used to say "it is free"; that claim is the regression this file exists
    // to catch, see the source scan at the bottom.
    expect(prereq?.text).not.toMatch(/\bfree\b/i);
    expect(prereq?.text).not.toContain("Not Partner");
    expect(prereq?.text).not.toContain("Patner");
  });

  it("offers the setup page for Stripe once a partner with Mesita Pay on lacks Connect", () => {
    const prereq = topPrerequisite({
      ...BASE,
      member: true,
      placeMesitaPay: true,
      connect: { kind: "none" },
      connectLoading: false,
    });
    expect(prereq?.action).toBe("setup");
    expect(prereq?.text).toContain("Connect Stripe");
  });

  it("says nothing about Stripe while the Mesita Pay switch is off or unknown", () => {
    // A reward is what a guest EARNS; a Partner-only place is not nagged to
    // connect Stripe here — the Pay rung says "Off in Products" instead, and
    // that is the add-on's own page to sell it.
    for (const placeMesitaPay of [false, null, undefined] as const) {
      expect(
        topPrerequisite({
          ...BASE,
          member: true,
          placeMesitaPay,
          connect: { kind: "none" },
          connectLoading: false,
        }),
      ).toBeNull();
    }
  });

  it("does not grow a disagreement line when asked and guests-get agree", () => {
    const row = rowFor(BASE, "pickup");
    expect(row.disagreement).toBeNull();
  });

  it("names a ghost-partner hold as the visit-rewards disagreement", () => {
    const row = rowFor(
      { ...BASE, visitRewardsLevel: 2, rewardLaneHeld: true },
      "visit_rewards",
    );
    expect(row.disagreement?.fix).toBe("restore");
  });

  it("sends a locked Rewards row to the setup page, never Join above", () => {
    const row = rowFor(
      { ...BASE, member: false, visitRewardsLevel: 2 },
      "visit_rewards",
    );
    expect(row.disagreement?.fix).toBe("setup");
    expect(row.disagreement?.fixLabel).toBe("Online Payments");
    expect(row.disagreement?.fixLabel).not.toContain("Join");
  });
});


// MESITA-1841. Capabilities and Rewards are two DISPLAYS of this one ladder.
// The engine stayed whole on purpose — the rungs depend on each other, and two
// copies of a dependency ladder is two copies that can disagree — so the only
// way the split can fail is a row that belongs to neither zone. Such a row
// renders nowhere, on no page, while every source-reading test stays green.
// That is the orphaned-view class MESITA-1804 named, and this is its guard.
describe("the ladder's two zones (MESITA-1841)", () => {
  const guestRows = () =>
    paintRows(offeringRows({ ...BASE, connect: { kind: "ready" } }));

  it("every guest row belongs to exactly one zone", () => {
    for (const row of guestRows()) {
      const zones = LADDER_ZONES.filter((z) => ZONE_ROWS[z].includes(row.key));
      expect(zones, `${row.key} is in ${zones.length} zones`).toHaveLength(1);
    }
  });

  it("the two zones partition the painted ladder — nothing lost, nothing doubled", () => {
    const all = guestRows();
    const split = LADDER_ZONES.flatMap((z) => rowsForZone(all, z));
    expect(split.map((r) => r.key).sort()).toEqual(all.map((r) => r.key).sort());
  });

  it("Partnership and Stripe belong to NO zone — they are prerequisites, not switches", () => {
    for (const z of LADDER_ZONES) {
      expect(ZONE_ROWS[z]).not.toContain("partnership");
      expect(ZONE_ROWS[z]).not.toContain("stripe");
    }
  });

  it("a zone IS a product, and each holds exactly its own rows (MESITA-1900)", () => {
    // The whole re-cut, written out. Capabilities' six rows redistributed to
    // the four products that own them; `visit_rewards` stayed under Visits
    // until MESITA-1900, when Pato's product list separated Rewards from
    // Visits and it went to the product it has always been a dial inside.
    //
    // Asserted as EQUALITY, not `toContain`: a row quietly gaining a second
    // home would satisfy containment in both places and put one switch on two
    // screens, which is how the console starts disagreeing with itself.
    //
    // VISITS IS EMPTY, AND THAT IS THE POINT. It has never had a switch — no
    // `visits_enabled` column, no rung, on for every partner (MESITA-1882) —
    // so the one row it carried was another product's. Asserting `[]` rather
    // than dropping the line keeps the emptiness DELIBERATE: a zone that
    // silently lost its rows and a zone that never had any read the same in
    // `ZONE_ROWS` and mean opposite things.
    expect(ZONE_ROWS.visits).toEqual([]);
    expect(ZONE_ROWS.orders).toEqual(["pickup", "delivery"]);
    expect(ZONE_ROWS.reservations).toEqual(["reservations"]);
    expect(ZONE_ROWS.rewards).toEqual(["visit_rewards"]);
    expect(ZONE_ROWS.pay).toEqual(["mesita_pay"]);
    expect(ZONE_ROWS.credits).toEqual(["accept_prepays", "sell_prepays"]);
  });

  it("NO ROW HAS TWO HOMES — the zones partition the ladder", () => {
    // The failure this split can have, and the one the old two-zone version
    // could not: five zones is five chances to list `mesita_pay` twice. The
    // other half — every row has at LEAST one home — is the totality test
    // above this block.
    const seen = LADDER_ZONES.flatMap((z) => [...ZONE_ROWS[z]]);
    expect(seen).toHaveLength(new Set(seen).size);
  });

  it("each zone's summary describes its own rows, never another's", () => {
    // `guestSummary` is fed the ZONE's rows, so Orders never claims guests
    // can earn rewards and Visits never claims they can book a table.
    const on: LadderInput = {
      ...BASE,
      visitRewardsLevel: 1,
      rails: { ...BASE.rails, mesita_pay: true },
      connect: { kind: "ready" },
      placeMesitaPay: true,
    };
    const all = offeringRows(on);
    expect(guestSummary(rowsForZone(all, "orders"))).not.toMatch(/visit rewards/i);
    expect(guestSummary(rowsForZone(all, "rewards"))).not.toMatch(/pay by card/i);
    expect(guestSummary(rowsForZone(all, "rewards"))).not.toMatch(/book a table/i);
    // AND VISITS' ZONE IS THE EMPTY SET, so `guestSummary` answers the
    // no-rows sentence — "Right now, nothing is live for guests." — which is
    // FALSE about a partner whose checkout works. `PromosSection` is why that
    // string never reaches the screen: it states the container's own fact for
    // a zone with no rungs (MESITA-1900). Pinned here so that anyone who
    // "simplifies" that branch away sees what it was protecting.
    expect(rowsForZone(all, "visits")).toEqual([]);
    expect(guestSummary(rowsForZone(all, "visits"))).toBe(
      "Right now, nothing is live for guests.",
    );
  });
});


// ── MESITA-1867: two tiers, one ladder ────────────────────────────────────
//
// The partnership was one free org switch, Stripe-locked. It is now Mesita
// Partner (the org's yearly subscription — the gate for Rewards) and Mesita
// Pay (an optional add-on: the org's Stripe account plus an org switch — the
// gate for the Pay rung). Every case below pairs with its opposite, so a
// branch that stops discriminating fails the pair rather than passing by
// rendering nothing.

const READY: LadderInput = { ...BASE, connect: { kind: "ready" }, connectLoading: false };

describe("the partnership row names the tier, not a price of zero", () => {
  it("is Mesita Partner, and its detail says yearly, never free", () => {
    const row = rowFor(BASE, "partnership");
    expect(row.label).toBe("Mesita Partner");
    expect(row.detail).toContain("yearly");
    expect(row.detail).not.toMatch(/\bfree\b/i);
  });

  it("a rung locked by the partnership says Needs Mesita Partner", () => {
    const input: LadderInput = { ...BASE, member: false };
    for (const key of ["visit_rewards", "accept_prepays", "mesita_pay", "stripe"]) {
      const row = rowFor(input, key);
      expect(row.state, key).toEqual({ kind: "locked", needs: "Needs Mesita Partner" });
    }
  });
});

describe("the org's Mesita Pay switch gates the place's Pay rung above Stripe", () => {
  it("off in Products locks Mesita Pay (Off in Products) and Sell Prepays (Needs Mesita Pay), whatever Stripe says", () => {
    const input: LadderInput = {
      ...READY,
      placeMesitaPay: false,
      rails: { ...BASE.rails, mesita_pay: true },
    };
    expect(rowFor(input, "mesita_pay").state).toEqual({
      kind: "locked",
      needs: "Off in Products",
    });
    expect(rowFor(input, "sell_prepays").state).toEqual({
      kind: "locked",
      needs: "Needs Online Payments",
    });
  });

  it("unknown in Products is Checking, never locked and never On — even with a ready account and the rail on", () => {
    // Hostile QA from the plan: null + ready + rail on must not read "On".
    for (const placeMesitaPay of [null, undefined] as const) {
      const input: LadderInput = {
        ...READY,
        placeMesitaPay,
        rails: { ...BASE.rails, mesita_pay: true },
      };
      expect(rowFor(input, "mesita_pay").state.kind).toBe("checking");
      expect(rowFor(input, "mesita_pay").disagreement).toBeNull();
    }
  });

  it("on in Products with a ready account is the place's own rail — on or off", () => {
    const off = rowFor({ ...READY, placeMesitaPay: true }, "mesita_pay");
    expect(off.state).toEqual({ kind: "off" });
    const on = rowFor(
      { ...READY, placeMesitaPay: true, rails: { ...BASE.rails, mesita_pay: true } },
      "mesita_pay",
    );
    expect(on.state).toEqual({ kind: "on" });
    expect(rowFor({ ...READY, placeMesitaPay: true, rails: { ...BASE.rails, mesita_pay: true } }, "sell_prepays").state.kind).toBe("soon");
  });

  it("on in Products still needs an ACTIVE Stripe account below it", () => {
    const input: LadderInput = { ...BASE, placeMesitaPay: true, connectLoading: false };
    expect(rowFor(input, "mesita_pay").state).toEqual({
      kind: "locked",
      needs: "Needs an active Stripe account",
    });
  });

  it("the Pay-switch lock's disagreement is fixed on the setup page, like Partner and Stripe", () => {
    const row = rowFor(
      { ...READY, placeMesitaPay: false, rails: { ...BASE.rails, mesita_pay: true } },
      "mesita_pay",
    );
    expect(row.disagreement?.fix).toBe("setup");
    expect(row.disagreement?.fixLabel).toBe("Online Payments");
    expect(row.disagreement?.reason).toContain("off in products");
  });

  it("the org switch never gates a rung the partnership alone unlocks", () => {
    // Rewards and Accept Prepays are bill arithmetic — Partner-only.
    const input: LadderInput = {
      ...READY,
      placeMesitaPay: false,
      visitRewardsLevel: 2,
      rails: { ...BASE.rails, credits: true },
    };
    expect(rowFor(input, "visit_rewards").state).toEqual({ kind: "on" });
    expect(rowFor(input, "accept_prepays").state).toEqual({ kind: "on" });
  });
});

describe("the top line: two partner facts, one precedence", () => {
  // `member` is the PLACE's entitlement (plan ≠ free) and gates every rung;
  // `placePartnered` only decides which door a non-member is sent to.
  const cells: {
    name: string;
    input: Partial<LadderInput>;
    expect: ReturnType<typeof topPrerequisite>;
  }[] = [
    {
      name: "member → silent, whatever the org says",
      input: { member: true, placePartnered: false, forfeited: false },
      expect: null,
    },
    {
      name: "not a member, place not partnered → subscribe in Products",
      input: { member: false, placePartnered: false },
      expect: {
        action: "setup",
        text: "Become a Mesita Partner in Products — it unlocks Rewards and Accept Prepays.",
      },
    },
    {
      name: "not a member, place partnered, forfeited → this place's own re-join",
      input: { member: false, placePartnered: true, forfeited: true },
      expect: {
        action: "rejoin",
        text: "This place forfeited the partnership after 3 strikes — an owner can re-join it.",
      },
    },
    {
      name: "not a member, place partnered, not forfeited (a dropped place) → the same door",
      input: { member: false, placePartnered: true, forfeited: false },
      expect: {
        action: "rejoin",
        text: "This place is not in the partnership — an owner can re-join it.",
      },
    },
    {
      name: "not a member, org unknown → nothing (a wrong door is worse than none)",
      input: { member: false, placePartnered: null, forfeited: true },
      expect: null,
    },
  ];

  for (const cell of cells) {
    it(cell.name, () => {
      expect(topPrerequisite({ ...READY, ...cell.input })).toEqual(cell.expect);
    });
  }

  it("a member's silence holds even with a forfeit flag left over", () => {
    // Belt and braces: plan wins. A stale `forfeited` next to member=true
    // (admin re-granted the plan by hand) must not paint a re-join line over
    // a place that is in.
    expect(topPrerequisite({ ...READY, member: true, placePartnered: true, forfeited: true })).toBeNull();
  });

  it("a re-join line never carries the SETUP door", () => {
    // The rejoin action is rendered WITHOUT a link (PromosSection) — a link
    // to the setup page there would send a forfeited place to subscribe
    // twice.
    const line = topPrerequisite({ ...READY, member: false, placePartnered: true, forfeited: true });
    expect(line?.action).toBe("rejoin");
    expect(line?.text).not.toContain("Products");
    expect(line?.text).not.toContain("Organization");
  });

  it("a re-join line names WHO, never where — and never promises a release", () => {
    // The button exists now (MESITA-1891) and it lives in the Visits box, but
    // this engine paints five zones and only Visits carries that box. So the
    // line still never says "below", and it no longer says "lands with the
    // next release" either: it names the rank that can press it, which is
    // true on all five.
    for (const forfeited of [true, false]) {
      const line = topPrerequisite({ ...READY, member: false, placePartnered: true, forfeited });
      expect(line?.text).toContain("an owner can re-join it");
      expect(line?.text).not.toMatch(/\bbelow\b/);
      expect(line?.text).not.toContain("next release");
      expect(line?.text).not.toContain("lands with");
    }
  });

  // MESITA-1889's 409 is a state, not a retry: the place has no live Mesita
  // Membership behind it, and a second press cannot change that. Printing
  // "try again" there would be the impossible retry MESITA-1736 shipped on
  // the rail switches.
  it("the join door's refusal discriminates a state from a retry", () => {
    expect(rejoinFailure(PLACE_NOT_PARTNERED)).toContain("no live Mesita Membership");
    expect(rejoinFailure(PLACE_NOT_PARTNERED)).not.toContain("try again");
    expect(rejoinFailure(null)).toContain("try again");
    expect(rejoinFailure("boom")).toBe(rejoinFailure(null));
  });
});

describe("the ladder's score still agrees with promotionScore over the new fields", () => {
  it("for every combination of member × org flags × connect × rails × level × forfeit", () => {
    let cases = 0;
    for (const member of [true, false]) {
      for (const placeMesitaPay of [true, false, null, undefined] as const) {
        for (const placePartnered of [true, false, null] as const) {
          for (const connectLoading of [true, false]) {
            for (const connect of [{ kind: "none" }, { kind: "ready" }] as const) {
              for (const mesita_pay of [true, false]) {
                for (const credits of [true, false]) {
                  for (const visitRewardsLevel of [0, 2]) {
                    for (const forfeited of [true, false]) {
                      const input: LadderInput = {
                        ...BASE,
                        member,
                        placeMesitaPay,
                        placePartnered,
                        connectLoading,
                        connect,
                        forfeited,
                        visitRewardsLevel,
                        rails: { ...BASE.rails, mesita_pay, credits },
                      };
                      expect(ladderScoreMatchesPromotionScore(input), JSON.stringify(input)).toBe(true);
                      cases++;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    // The matrix is what makes this a test: a loop that runs zero times
    // passes every expectation in it.
    expect(cases).toBe(2 * 4 * 3 * 2 * 2 * 2 * 2 * 2 * 2);
  });
});

// ── No "free" claim survives in the partnership's copy ────────────────────
//
// The whole of MESITA-1867 is that the partnership is not free any more. A
// phrase list ("is free", "it's free") missed the real copy twice while the
// plan was reviewed, so the guard is the WORD, in every string literal and
// every JSX text run of the three files that speak for the partnership, with
// an allowlist of the exact spellings that may keep it. Comments are not
// copy and are skipped — they are where the history of "free" belongs.

const COPY_FILES = ["./offerings.ts", "./partnership.tsx", "../promo-state.ts"];

/** Whole literals that ARE the word: the plan enum key (`plan !== "free"`). */
const FREE_LITERALS = new Set(["free"]);
/** Phrases that may carry the word: Zero is the absence of the product and
 *  costs nothing, and the body says so in exactly these words. */
const FREE_PHRASES = ["Zero stays free"];

const FREE = /\bfree\b/i;

/** Split a source file into its string literals and its remaining code
 *  (comments dropped, literals blanked). JSX text lives in the code half. */
function splitSource(src: string): { literals: string[]; code: string } {
  const literals: string[] = [];
  let code = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      const end = src.indexOf("\n", i);
      i = end === -1 ? src.length : end;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      let out = "";
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\\") {
          out += src[j] + (src[j + 1] ?? "");
          j += 2;
          continue;
        }
        out += src[j];
        j++;
      }
      literals.push(out);
      code += " ";
      i = j + 1;
      continue;
    }
    code += c;
    i++;
  }
  return { literals, code };
}

/** JSX text runs: whatever sits between tag and brace delimiters. Code
 *  fragments land here too, which is fine — an identifier is never the
 *  whole word "free" on its own. */
function textRuns(code: string): string[] {
  return code
    .split(/[<>{}]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function withoutAllowedPhrases(s: string): string {
  return FREE_PHRASES.reduce((acc, phrase) => acc.split(phrase).join(" "), s);
}

describe("no \"free\" claim survives in the partnership's copy (MESITA-1867)", () => {
  const sources = COPY_FILES.map((f) => ({
    file: f,
    ...splitSource(readFileSync(path.join(__dirname, f), "utf8")),
  }));

  it("the scan reads the real files — the allowlisted spellings are found where they live", () => {
    const partnership = sources.find((s) => s.file === "./partnership.tsx")!;
    expect(textRuns(partnership.code).some((t) => t.includes("Zero stays free"))).toBe(true);
    const promo = sources.find((s) => s.file === "../promo-state.ts")!;
    expect(promo.literals).toContain("free");
  });

  for (const src of sources) {
    it(`${src.file}: no string literal says free, outside the allowlist`, () => {
      const offenders = src.literals.filter(
        (lit) => FREE.test(lit) && !FREE_LITERALS.has(lit) && FREE.test(withoutAllowedPhrases(lit)),
      );
      expect(offenders, offenders.join("\n")).toEqual([]);
    });

    it(`${src.file}: no JSX text says free, outside the allowlist`, () => {
      const offenders = textRuns(src.code).filter(
        (t) => FREE.test(t) && FREE.test(withoutAllowedPhrases(t)),
      );
      expect(offenders, offenders.join("\n")).toEqual([]);
    });
  }
});

// MESITA-1867 review: both org flags are OPTIONAL on the payload, and the
// console once collapsed `undefined` to `false` — a stale payload told a
// paying org's place to subscribe again. Absent is unknown, never off.
describe("an absent org flag is unknown, never off", () => {
  it("tierFlag maps undefined/null to null and keeps booleans", () => {
    expect(tierFlag(undefined)).toBeNull();
    expect(tierFlag(null)).toBeNull();
    expect(tierFlag(true)).toBe(true);
    expect(tierFlag(false)).toBe(false);
  });
});

// ── THE PAY RUNG'S RANK (MESITA-1891 review) ──────────────────────────────
//
// Two surfaces, one door. `business-web-set-place-rails` takes `requireOwner`
// for the `mesita_pay` key and `requireEditor` for the other three
// (MESITA-1892 collapsed the organization's half of the bit into this column
// and the EF kept the rank that collapse would otherwise have handed to every
// editor). `MesitaPayCard` matches it — a non-owner gets a static switch and
// "An owner turns this on." This ladder did not: it handed an editor an
// operable switch whose write the server refuses. An enabled control that
// 403s is worse than either answer, so the rung takes the rank too.
//
// The predicate is restated here as a literal rather than imported — two
// install roots, and THAT is the thing under test, exactly as the T5 block
// above restates web-consumer's.
describe("the Mesita Pay rung agrees with the door about who may set it", () => {
  const efAllows = (role: "owner" | "editor" | "viewer", key: string) =>
    key === "mesita_pay" ? role === "owner" : role !== "viewer";

  const payReady = { ...READY, placeMesitaPay: true };
  const owner = (over: Partial<LadderInput> = {}) =>
    rowFor({ ...payReady, isOwner: true, ...over }, "mesita_pay");
  const editor = (over: Partial<LadderInput> = {}) =>
    rowFor({ ...payReady, isOwner: false, ...over }, "mesita_pay");

  it("an editor gets no switch, because the EF would refuse the write", () => {
    expect(efAllows("editor", "mesita_pay")).toBe(false);
    // `on`/`off` is what LadderRow renders as a button; anything else is not
    // a control. That is the bit the console and the EF have to agree on.
    const state = editor().state;
    expect(state.kind).toBe("not_mine");
    expect(["on", "off"]).not.toContain(state.kind);
  });

  it("an owner still gets one — the bijection", () => {
    expect(efAllows("owner", "mesita_pay")).toBe(true);
    expect(owner().state.kind).toBe("off");
    expect(
      owner({ rails: { ...BASE.rails, mesita_pay: true } }).state.kind,
    ).toBe("on");
  });

  it("the other three rails keep editor, on both sides", () => {
    for (const key of ["accept_prepays", "pickup", "delivery"]) {
      expect(efAllows("editor", key === "accept_prepays" ? "credits" : key)).toBe(true);
      expect(rowFor({ ...payReady, isOwner: false }, key).state.kind).toBe("off");
    }
  });

  it("unknown rank changes nothing — null is not 'not yours'", () => {
    // The role is read off the rail's own list, which is absent on a pool
    // place or a page rendered without the shell. Telling an owner the switch
    // is not theirs is the same class of lie as telling a paying place it is
    // off.
    for (const isOwner of [null, undefined] as const) {
      expect(rowFor({ ...payReady, isOwner }, "mesita_pay").state.kind).toBe("off");
    }
  });

  it("rank never outranks a prerequisite — the card's own branch order", () => {
    // An editor at a place that has not met the prerequisites must read the
    // prerequisite, not "Owner only": what is missing is the place's, and it
    // is the thing anybody can act on.
    expect(editor({ member: false }).state).toEqual({
      kind: "locked",
      needs: "Needs Mesita Partner",
    });
    expect(editor({ placeMesitaPay: false }).state.kind).toBe("locked");
    expect(editor({ connect: { kind: "none" } }).state).toEqual({
      kind: "locked",
      needs: "Needs an active Stripe account",
    });
    expect(editor({ connectLoading: true }).state.kind).toBe("checking");
  });

  it("an editor still reads the TRUE state of card acceptance", () => {
    // THE REGRESSION A `locked` RUNG WOULD HAVE SHIPPED. `locked` renders off,
    // so a place taking card payments would have told its editor it takes
    // none — the MESITA-1735 class of bug, on the one rung where it is money —
    // and manufactured a disagreement line saying guests do not get what they
    // are already getting.
    const live = { ...payReady, isOwner: false, rails: { ...BASE.rails, mesita_pay: true } };
    const row = rowFor(live, "mesita_pay");
    expect(row.state).toEqual({ kind: "not_mine", word: "Owner only", on: true });
    expect(row.disagreement).toBeNull();
    expect(guestSummary(offeringRows(live))).toContain("pay by card");
    // And it still scores: the place offers it, whoever is looking.
    expect(row.earned).toBe(true);
    expect(ladderScoreMatchesPromotionScore(live)).toBe(true);
  });

  it("and PromosSection actually feeds it the caller's role", () => {
    // The seam this file cannot cross: the engine can take the rank and the
    // only caller can still never pass it, which is how the re-join branch
    // went dead in this same issue. `?? null` is load-bearing — `=== "owner"`
    // on a missing rail row would hand every unknown reader `false`.
    const src = readFileSync(
      path.resolve(__dirname, "../PromosSection.tsx"),
      "utf8",
    );
    expect(src).toMatch(/isOwner:\s*ownsPay/);
    expect(src).toMatch(/myRole\s*===\s*null\s*\?\s*null\s*:/);
  });

  it("a rung nobody may set still paints, under 'Not yours to set'", () => {
    // `paintRows` ranks `not_mine` last so it lands in that group — the same
    // shelf `reservations` sits on. Dropping off the page entirely would be
    // the one failure mode this state can have.
    const painted = paintRows(rowsForZone(offeringRows({ ...payReady, isOwner: false }), "pay"));
    expect(painted.map((r) => r.key)).toEqual(["mesita_pay"]);
  });
});
