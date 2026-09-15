import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LADDER_ZONES,
  ZONE_ROWS,
  guestSummary,
  ladderScoreMatchesPromotionScore,
  offeringRows,
  paintRows,
  rowsForZone,
  orgFlag,
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

describe("the stripe rung's copy — org state, not place state (MESITA-1684)", () => {
  it("says the ORGANIZATION owns the account, never the place", () => {
    const row = stripeRow(BASE);
    expect(row.detail).toContain("Your organization owns the account");
    expect(row.detail).not.toContain("The place owns");
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
    // orgMesitaPay is KNOWN on here, so the Connect read alone decides.
    const input: LadderInput = { ...BASE, connectLoading: true, orgMesitaPay: true };
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

  it("sends a non-partner whose org is not partnered to subscribe on Organization", () => {
    const prereq = topPrerequisite({ ...BASE, member: false, orgPartnered: false });
    expect(prereq?.action).toBe("organization");
    expect(prereq?.text).toContain("Mesita Partner");
    // The partnership is a yearly subscription now (MESITA-1867). The line
    // used to say "it is free"; that claim is the regression this file exists
    // to catch, see the source scan at the bottom.
    expect(prereq?.text).not.toMatch(/\bfree\b/i);
    expect(prereq?.text).not.toContain("Not Partner");
    expect(prereq?.text).not.toContain("Patner");
  });

  it("offers Organization for Stripe once a partner with the org's Pay on lacks Connect", () => {
    const prereq = topPrerequisite({
      ...BASE,
      member: true,
      orgMesitaPay: true,
      connect: { kind: "none" },
      connectLoading: false,
    });
    expect(prereq?.action).toBe("organization");
    expect(prereq?.text).toContain("Connect Stripe");
  });

  it("says nothing about Stripe while the org's Pay switch is off or unknown", () => {
    // Rewards is what a guest EARNS; a Partner-only org is not nagged to
    // connect Stripe here — the Pay rung on Capabilities says "Off on
    // Organization" instead, and that is the add-on's own page to sell it.
    for (const orgMesitaPay of [false, null, undefined] as const) {
      expect(
        topPrerequisite({
          ...BASE,
          member: true,
          orgMesitaPay,
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

  it("sends a locked Visit Rewards row to Organization, never Join above", () => {
    const row = rowFor(
      { ...BASE, member: false, visitRewardsLevel: 2 },
      "visit_rewards",
    );
    expect(row.disagreement?.fix).toBe("organization");
    expect(row.disagreement?.fixLabel).toBe("Organization");
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

  it("Rewards is what a guest EARNS; Capabilities is what a guest can DO", () => {
    expect(ZONE_ROWS.rewards).toEqual(["visit_rewards"]);
    expect(ZONE_ROWS.capabilities).toContain("mesita_pay");
    expect(ZONE_ROWS.capabilities).toContain("reservations");
    expect(ZONE_ROWS.capabilities).not.toContain("visit_rewards");
  });

  it("each zone's summary describes its own rows, never the other's", () => {
    // `guestSummary` is fed the ZONE's rows, so Capabilities never claims
    // guests can earn rewards and Rewards never claims they can book a table.
    const on: LadderInput = {
      ...BASE,
      visitRewardsLevel: 1,
      rails: { ...BASE.rails, mesita_pay: true },
      connect: { kind: "ready" },
      orgMesitaPay: true,
    };
    const all = offeringRows(on);
    expect(guestSummary(rowsForZone(all, "capabilities"))).not.toMatch(/visit rewards/i);
    expect(guestSummary(rowsForZone(all, "rewards"))).not.toMatch(/pay by card/i);
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
  it("off on Organization locks Mesita Pay (Off on Organization) and Sell Prepays (Needs Mesita Pay), whatever Stripe says", () => {
    const input: LadderInput = {
      ...READY,
      orgMesitaPay: false,
      rails: { ...BASE.rails, mesita_pay: true },
    };
    expect(rowFor(input, "mesita_pay").state).toEqual({
      kind: "locked",
      needs: "Off on Organization",
    });
    expect(rowFor(input, "sell_prepays").state).toEqual({
      kind: "locked",
      needs: "Needs Mesita Pay",
    });
  });

  it("unknown on Organization is Checking, never locked and never On — even with a ready account and the rail on", () => {
    // Hostile QA from the plan: null + ready + rail on must not read "On".
    for (const orgMesitaPay of [null, undefined] as const) {
      const input: LadderInput = {
        ...READY,
        orgMesitaPay,
        rails: { ...BASE.rails, mesita_pay: true },
      };
      expect(rowFor(input, "mesita_pay").state.kind).toBe("checking");
      expect(rowFor(input, "mesita_pay").disagreement).toBeNull();
    }
  });

  it("on on Organization with a ready account is the place's own rail — on or off", () => {
    const off = rowFor({ ...READY, orgMesitaPay: true }, "mesita_pay");
    expect(off.state).toEqual({ kind: "off" });
    const on = rowFor(
      { ...READY, orgMesitaPay: true, rails: { ...BASE.rails, mesita_pay: true } },
      "mesita_pay",
    );
    expect(on.state).toEqual({ kind: "on" });
    expect(rowFor({ ...READY, orgMesitaPay: true, rails: { ...BASE.rails, mesita_pay: true } }, "sell_prepays").state.kind).toBe("soon");
  });

  it("on on Organization still needs an ACTIVE Stripe account below it", () => {
    const input: LadderInput = { ...BASE, orgMesitaPay: true, connectLoading: false };
    expect(rowFor(input, "mesita_pay").state).toEqual({
      kind: "locked",
      needs: "Needs an active Stripe account",
    });
  });

  it("the org-pay lock's disagreement is fixed on Organization, like Partner and Stripe", () => {
    const row = rowFor(
      { ...READY, orgMesitaPay: false, rails: { ...BASE.rails, mesita_pay: true } },
      "mesita_pay",
    );
    expect(row.disagreement?.fix).toBe("organization");
    expect(row.disagreement?.fixLabel).toBe("Organization");
    expect(row.disagreement?.reason).toContain("off on organization");
  });

  it("the org switch never gates a rung the partnership alone unlocks", () => {
    // Visit Rewards and Accept Prepays are bill arithmetic — Partner-only.
    const input: LadderInput = {
      ...READY,
      orgMesitaPay: false,
      visitRewardsLevel: 2,
      rails: { ...BASE.rails, credits: true },
    };
    expect(rowFor(input, "visit_rewards").state).toEqual({ kind: "on" });
    expect(rowFor(input, "accept_prepays").state).toEqual({ kind: "on" });
  });
});

describe("the top line: two partner facts, one precedence", () => {
  // `member` is the PLACE's entitlement (plan ≠ free) and gates every rung;
  // `orgPartnered` only decides which door a non-member is sent to.
  const cells: {
    name: string;
    input: Partial<LadderInput>;
    expect: ReturnType<typeof topPrerequisite>;
  }[] = [
    {
      name: "member → silent, whatever the org says",
      input: { member: true, orgPartnered: false, forfeited: false },
      expect: null,
    },
    {
      name: "not a member, org not partnered → subscribe on Organization",
      input: { member: false, orgPartnered: false },
      expect: {
        action: "organization",
        text: "Become a Mesita Partner on Organization — it unlocks Visit Rewards and Accept Prepays.",
      },
    },
    {
      name: "not a member, org partnered, forfeited → this place's own re-join, unbuilt",
      input: { member: false, orgPartnered: true, forfeited: true },
      expect: {
        action: "rejoin",
        text: "This place forfeited the partnership after 3 strikes — re-join lands with the next release.",
      },
    },
    {
      name: "not a member, org partnered, not forfeited (a dropped place) → the same door",
      input: { member: false, orgPartnered: true, forfeited: false },
      expect: {
        action: "rejoin",
        text: "This place is not in the partnership — re-join lands with the next release.",
      },
    },
    {
      name: "not a member, org unknown → nothing (a wrong door is worse than none)",
      input: { member: false, orgPartnered: null, forfeited: true },
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
    expect(topPrerequisite({ ...READY, member: true, orgPartnered: true, forfeited: true })).toBeNull();
  });

  it("a re-join line never carries the Organization door", () => {
    // The rejoin action is rendered WITHOUT a link (PromosSection) — a link
    // to Organization there would send a forfeited place to subscribe twice.
    const line = topPrerequisite({ ...READY, member: false, orgPartnered: true, forfeited: true });
    expect(line?.action).toBe("rejoin");
    expect(line?.text).not.toContain("Organization");
  });

  it("a re-join line never points at a door that is not on the page", () => {
    // The engine paints two zones and only Rewards carries the partnership
    // box; the re-join door is unbuilt in this PR. So the line says when the
    // door lands and never "below" — on Capabilities there is nothing below,
    // and on Rewards there is no button to be below.
    for (const forfeited of [true, false]) {
      const line = topPrerequisite({ ...READY, member: false, orgPartnered: true, forfeited });
      expect(line?.text).toContain("lands with the next release");
      expect(line?.text).not.toMatch(/\bbelow\b/);
    }
  });
});

describe("the ladder's score still agrees with promotionScore over the new fields", () => {
  it("for every combination of member × org flags × connect × rails × level × forfeit", () => {
    let cases = 0;
    for (const member of [true, false]) {
      for (const orgMesitaPay of [true, false, null, undefined] as const) {
        for (const orgPartnered of [true, false, null] as const) {
          for (const connectLoading of [true, false]) {
            for (const connect of [{ kind: "none" }, { kind: "ready" }] as const) {
              for (const mesita_pay of [true, false]) {
                for (const credits of [true, false]) {
                  for (const visitRewardsLevel of [0, 2]) {
                    for (const forfeited of [true, false]) {
                      const input: LadderInput = {
                        ...BASE,
                        member,
                        orgMesitaPay,
                        orgPartnered,
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
  it("orgFlag maps undefined/null to null and keeps booleans", () => {
    expect(orgFlag(undefined)).toBeNull();
    expect(orgFlag(null)).toBeNull();
    expect(orgFlag(true)).toBe(true);
    expect(orgFlag(false)).toBe(false);
  });
});
