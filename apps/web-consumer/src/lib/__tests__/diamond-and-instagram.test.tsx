// TWO FACTS, AND NEITHER MAY LEAK INTO THE OTHER (MESITA-2040).
//
// This file replaces class-naming-drift.test.tsx and class-unknown-state.
// test.tsx, and it is worth saying what each of those was for, because the
// bugs they caught can still happen in a different shape.
//
//   class-naming-drift pinned that copy quoting a follower bar quoted the rung
//   that bar actually granted — twice a metal had been written into a sentence
//   that rendered for a different metal. There is one fact per sentence now,
//   so the class of bug that remains is a sentence about Instagram appearing
//   in a Diamond state, or the reverse. INDEPENDENCE is the assertion.
//
//   class-unknown-state pinned that a FAILED profile read is never stated as
//   a fact. That bug is completely unchanged: the floor fallback still makes
//   "we couldn't read it" and "you don't have it" one boolean apart, and the
//   wrong one is invisible in a screenshot.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ClassProvider, useConsumerClass } from "@/lib/class-context";
import {
  DIAMOND_LIST_HOW,
  INSTAGRAM_REACH_FOLLOWERS,
  diamondChipLabel,
  diamondHeadline,
  diamondNote,
  diamondSummary,
  instagramNote,
  instagramSummary,
  type ConsumerFacts,
} from "@/lib/consumer-identity";
import type { ConsumerClass } from "@/lib/api/profile";

function consumerClass(patch: Partial<ConsumerClass>): ConsumerClass {
  return {
    key: "standard",
    origin: "default",
    label: "",
    followers: 0,
    expires_at: null,
    subscription: null,
    ...patch,
  } as unknown as ConsumerClass;
}

/** Renders the facts the provider settled on as a JSON blob, so a test can
 *  assert the DERIVATION rather than a component's markup. */
function Probe() {
  const { facts } = useConsumerClass();
  return <span>{JSON.stringify(facts)}</span>;
}

function factsFrom(
  row: ConsumerClass | null,
  instagramHandle: string | null = null,
  classUnavailable = false,
): ConsumerFacts {
  const html = renderToStaticMarkup(
    <ClassProvider
      consumerClass={row}
      instagramHandle={instagramHandle}
      classUnavailable={classUnavailable}
    >
      <Probe />
    </ClassProvider>,
  );
  return JSON.parse(
    html.replace(/^<span>/, "").replace(/<\/span>$/, "").replace(/&quot;/g, '"'),
  ) as ConsumerFacts;
}

describe("Diamond is read off the class key, not off the origin", () => {
  it("a legacy `aura` row is Diamond", () => {
    // The bridge maps aura -> diamond. Reading the raw key here instead would
    // silently demote every account granted before the metals landed.
    expect(factsFrom(consumerClass({ key: "aura" })).diamond).toBe(true);
  });

  it("a `diamond` row with NO origin stamped is still Diamond", () => {
    // The admin console's grant writes the class and leaves origin alone. An
    // `origin === "invitation"` test would tell a hand-granted Diamond they
    // are not one — the exact bug shape class-naming-drift existed for.
    // (Its EF name stays out of this package: ef-caller-acl.test.ts scans it.)
    expect(
      factsFrom(consumerClass({ key: "diamond", origin: "default" })).diamond,
    ).toBe(true);
  });

  it("every other row is not Diamond, however it was granted", () => {
    for (const key of ["standard", "influencer", "premium", "bronze", "silver", "gold"]) {
      expect(factsFrom(consumerClass({ key })).diamond, key).toBe(false);
    }
  });
});

describe("Instagram is the handle, and the bar is the bar", () => {
  it("a handle with no count is connected but not verified", () => {
    const f = factsFrom(consumerClass({ followers: 0 }), "mock");
    expect(f.igConnected).toBe(true);
    expect(f.igReach).toBe(false);
    expect(f.igHandle).toBe("mock");
  });

  it(`${INSTAGRAM_REACH_FOLLOWERS} exactly clears the bar`, () => {
    const at = factsFrom(
      consumerClass({ followers: INSTAGRAM_REACH_FOLLOWERS }),
      "mock",
    );
    const under = factsFrom(
      consumerClass({ followers: INSTAGRAM_REACH_FOLLOWERS - 1 }),
      "mock",
    );
    expect(at.igReach).toBe(true);
    expect(under.igReach).toBe(false);
  });

  it("the bar is 1,000 — Pato's number, and the same one on both platforms", () => {
    // Mobile's own constant said 2,000 for weeks while web said 1,000, and
    // nothing compared them. The number is pinned literally here so a silent
    // drift back has to come through this line.
    expect(INSTAGRAM_REACH_FOLLOWERS).toBe(1_000);
  });

  it("a count with no handle is not a connection", () => {
    // A stale `followers` column on an account that disconnected must not
    // read as verified.
    const f = factsFrom(consumerClass({ followers: 50_000 }), null);
    expect(f.igConnected).toBe(false);
    expect(f.igReach).toBe(false);
  });
});

describe("the two facts do not touch", () => {
  it("Diamond with no Instagram", () => {
    const f = factsFrom(consumerClass({ key: "aura", origin: "invitation" }));
    expect(f.diamond).toBe(true);
    expect(f.igConnected).toBe(false);
    expect(f.igReach).toBe(false);
  });

  it("Instagram, over the bar, with no Diamond", () => {
    const f = factsFrom(
      consumerClass({ key: "silver", origin: "instagram", followers: 50_000 }),
      "mock",
    );
    expect(f.igReach).toBe(true);
    expect(f.diamond).toBe(false);
  });

  it("both at once", () => {
    const f = factsFrom(
      consumerClass({ key: "diamond", origin: "invitation", followers: 9_000 }),
      "mock",
    );
    expect(f.diamond).toBe(true);
    expect(f.igReach).toBe(true);
  });
});

describe("a read that FAILED is never stated as a fact", () => {
  const unknown = factsFrom(null, null, true);

  it("carries the failure through to the facts", () => {
    expect(unknown.unknown).toBe(true);
  });

  it("says neither yes nor no, on either fact", () => {
    // The floor fallback makes a thrown read look like a plain account. These
    // four lines are what stop the app asserting the guess.
    expect(diamondSummary(unknown)).toBe("Come back to try");
    expect(diamondChipLabel(unknown)).toBe("Come back to try");
    expect(instagramSummary(unknown)).toBe("Come back to try");
    expect(diamondNote(unknown)).not.toMatch(/invitation only|Invited by/);
    expect(instagramNote(unknown, "0 followers")).not.toMatch(
      /verified|verifies/,
    );
  });

  it("a missing row that did NOT throw is an ordinary empty account", () => {
    // "We read it and there is nothing" and "we could not read it" are one
    // boolean apart; only the second may hedge.
    const empty = factsFrom(null, null, false);
    expect(empty.unknown).toBe(false);
    expect(diamondSummary(empty)).toBe("Ask to join");
  });
});

describe("no sentence about one fact mentions the other", () => {
  const states: ConsumerFacts[] = [
    { diamond: false, igConnected: false, igHandle: null, igFollowers: 0, igReach: false, unknown: false },
    { diamond: true, igConnected: false, igHandle: null, igFollowers: 0, igReach: false, unknown: false },
    { diamond: false, igConnected: true, igHandle: "mock", igFollowers: 200, igReach: false, unknown: false },
    { diamond: false, igConnected: true, igHandle: "mock", igFollowers: 5_000, igReach: true, unknown: false },
    { diamond: true, igConnected: true, igHandle: "mock", igFollowers: 5_000, igReach: true, unknown: false },
  ];

  it.each(states)("the Diamond line never says Instagram (%j)", (f) => {
    expect(diamondSummary(f)).not.toMatch(/instagram|follower/i);
    expect(diamondChipLabel(f)).not.toMatch(/instagram|follower/i);
    expect(diamondHeadline(f)).not.toMatch(/instagram|follower/i);
    expect(diamondNote(f)).not.toMatch(/instagram|follower/i);
  });

  it.each(states)("the Instagram line never says Diamond (%j)", (f) => {
    expect(instagramSummary(f)).not.toMatch(/diamond|invit/i);
    expect(instagramNote(f, "5k followers")).not.toMatch(/diamond|invit/i);
  });

  it("and no line names a retired rung", () => {
    // The whole ladder, in one assertion. `classes` still prices Rewards, so
    // these words are alive elsewhere in the app — they are simply not the
    // guest's identity any more, and this is the surface that must not say so.
    for (const f of states) {
      for (const line of [
        diamondSummary(f),
        diamondChipLabel(f),
        diamondHeadline(f),
        diamondNote(f),
        instagramSummary(f),
        instagramNote(f, "5k followers"),
      ]) {
        expect(line).not.toMatch(
          /\b(bronze|silver|gold|class|vip|tier|rank|rung|level|climb)\b/i,
        );
        // "Diamond" is only ever the Diamond List, never a status noun.
        expect(line).not.toMatch(/Diamond(?! List)/);
      }
    }
  });
});

describe("the Diamond List's copy, pinned (web and mobile match this)", () => {
  const off: ConsumerFacts = { diamond: false, igConnected: false, igHandle: null, igFollowers: 0, igReach: false, unknown: false };
  const on: ConsumerFacts = { ...off, diamond: true };

  it("the Me tile and the header chip", () => {
    expect(diamondSummary(on)).toBe("You're on it");
    expect(diamondSummary(off)).toBe("Ask to join");
    expect(diamondChipLabel(on)).toBe("Diamond List");
    expect(diamondChipLabel(off)).toBe("Ask to join");
  });

  it("the page headline and the how line", () => {
    expect(diamondHeadline(on)).toBe("You're on the Diamond List");
    expect(diamondHeadline(off)).toBe("You're not on the list yet");
    expect(diamondNote(off)).toBe(DIAMOND_LIST_HOW);
    expect(DIAMOND_LIST_HOW).toBe(
      "The Diamond List is invitation-only. Ask Mesita to join, or enter a PIN if someone gave you one.",
    );
  });
});
