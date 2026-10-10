// The re-join door, END TO END across the server action (MESITA-1891).
//
// WHY THIS FILE EXISTS. `offerings.test.ts` already proves `rejoinFailure`
// discriminates the 409 from a retry — but it calls that function directly,
// with a code it types itself, so it passes whether or not a code ever
// reaches it. It did not. `setPlacePlan` returned `{ ok: false, error }` and
// dropped `r.code`; the failure arm of `Result<T>` types `code` as OPTIONAL,
// so `r.code ?? null` in `PromosSection.commitRejoin` type-checked and was
// `undefined` on every call. The branch was dead from the day it shipped, and
// the exact case it exists for — a Membership that lapsed between page load
// and click, which answers 409 `place_not_partnered` — printed "Couldn't
// re-join this place. Nothing changed — try again." That impossible retry is
// what `rejoinFailure`'s own docblock says it was added to prevent.
//
// So this test crosses the wiring instead of standing next to it: a real
// Edge Function refusal goes in at `efInvoke`, and the sentence an operator
// reads comes out. The one seam it cannot cross — the component's own
// `r.code ?? null`, which needs a DOM this package's vitest does not have —
// is pinned by a source scan, the same idiom `control-affordances.test.ts`
// and the old `session-gate.test.ts` use.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PLACE_NOT_PARTNERED,
  rejoinFailure,
} from "./sections/controls/offerings";

const efInvoke = vi.fn();
vi.mock("@/lib/supabase-ef", () => ({
  efInvoke: (...args: unknown[]) => efInvoke(...args),
}));

// Imported after the mock is registered — `actions.ts` calls `efInvoke` at
// call time, not import time, but hoisting rules make the order load-bearing
// to a reader.
const { setPlacePlan } = await import("./actions");

/** What `business-web-set-partnership` actually answers when the place has no
 *  live Mesita Membership behind it: 409, `code: "place_not_partnered"`, and
 *  a server sentence written for a log. Shaped like `EFFailure` in
 *  `lib/supabase-ef.ts`. */
const LAPSED_409 = {
  ok: false as const,
  status: 409,
  code: PLACE_NOT_PARTNERED,
  fn: "business-web-set-partnership",
  error: "This place has no live membership to join.",
  data: null,
};

beforeEach(() => {
  efInvoke.mockReset();
});

describe("a 409 from the join door surfaces the Membership sentence", () => {
  it("the action forwards the EF's code, not just its prose", async () => {
    efInvoke.mockResolvedValue(LAPSED_409);
    const r = await setPlacePlan("place-1", "pro");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    // The assertion that was missing. `undefined` here is the defect: it is
    // what a call site's `r.code ?? null` collapses to null, which is the
    // retry branch.
    expect(r.code).toBe(PLACE_NOT_PARTNERED);
  });

  it("and what the operator reads names the Membership, never a retry", async () => {
    efInvoke.mockResolvedValue(LAPSED_409);
    const r = await setPlacePlan("place-1", "pro");
    if (r.ok) throw new Error("unreachable");
    // The component's own expression, run over the action's real result.
    const shown = rejoinFailure(r.code ?? null);
    expect(shown).toContain("no live Mesita Membership");
    expect(shown).not.toContain("try again");
  });

  it("a refusal with no code still gets the retry sentence — the bijection", async () => {
    // Without this, "always says Membership" would pass the test above too.
    efInvoke.mockResolvedValue({ ...LAPSED_409, status: 500, code: null });
    const r = await setPlacePlan("place-1", "pro");
    if (r.ok) throw new Error("unreachable");
    expect(r.code).toBe(null);
    expect(rejoinFailure(r.code ?? null)).toContain("try again");
  });

  it("the join door is the partnership EF, with action=join", async () => {
    // Guards the three assertions above against a mock that would answer any
    // call: they are only about the re-join door if this is the call made.
    efInvoke.mockResolvedValue(LAPSED_409);
    await setPlacePlan("place-1", "pro");
    expect(efInvoke).toHaveBeenCalledWith(
      "business-web-set-partnership",
      expect.objectContaining({ placeId: "place-1", action: "join" }),
    );
  });
});

describe("the console feeds that code into the copy", () => {
  const SRC = readFileSync(
    path.resolve(__dirname, "sections/PromosSection.tsx"),
    "utf8",
  );

  it("commitRejoin passes the action's own code, never a literal", () => {
    expect(SRC).toMatch(/rejoinFailure\(\s*r\.code\s*\?\?\s*null\s*\)/);
    expect(SRC).not.toMatch(/rejoinFailure\(\s*null\s*\)/);
  });
});
