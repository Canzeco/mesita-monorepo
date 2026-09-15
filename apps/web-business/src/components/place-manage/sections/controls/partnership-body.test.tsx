// The Rewards partnership box, once per pill state (MESITA-1867).
//
// This box had no render test before: it was member-gated, so the only shape
// it could take was "a member reading their own live partnership". The two
// tiers changed that — it now renders for a place that was never in and for
// one that forfeited, and the review of the first cut found both of those
// new shapes saying something false. Each fix below is a pair: the input
// that must produce a line, and the input that must NOT.
//
// No jsdom here (this package's vitest runs in node), so these are
// `renderToStaticMarkup` reads of a hook-free component — PartnershipBody
// and LifecycleBanner take everything they know as props.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PartnershipBody } from "./partnership";
import { type AdminPlace } from "../../actions";
import { type MembershipPillState } from "../promo-state";

/** The four columns a strategy is matched on, all null = Zero, plus the
 *  lifecycle stamps each state needs. Cast because AdminPlace is the whole
 *  manage payload and this box reads six fields of it. */
function place(over: Partial<AdminPlace> = {}): AdminPlace {
  return {
    id: "place-1",
    plan: "free",
    welcome_free_rate: null,
    welcome_premium_rate: null,
    free_rate: null,
    premium_rate: null,
    ...over,
  } as AdminPlace;
}

function body(
  pillState: MembershipPillState,
  over: { isOwner?: boolean; place?: AdminPlace } = {},
) {
  return renderToStaticMarkup(
    <PartnershipBody
      place={over.place ?? place(pillState === "not_member" ? {} : { plan: "pro" })}
      pillState={pillState}
      storedStrategy={null}
      member={pillState !== "not_member" && pillState !== "forfeited"}
      orgHref="/orgs/org-1/configuration"
      isOwner={over.isOwner ?? true}
    />,
  );
}

// The first cut rendered the three-step banner in every state, so a place
// whose organization had never subscribed read the same door three times in
// eight lines: the page's top line, the banner's step 1 ("Subscribe on
// Organization — yearly…"), then the pitch. The banner is for a place that
// is IN; the pitch is what a non-member needs.
describe("a non-member gets the pitch alone", () => {
  const html = body("not_member");

  it("no lifecycle banner, so the door is not repeated", () => {
    expect(html).not.toContain("Subscribe on Organization");
    expect(html).not.toContain("Become a Mesita Partner");
    expect(html).not.toContain("Pick a strategy");
    expect(html).not.toContain("Honor guest checks");
  });

  it("but the pitch itself is there, and names the tier", () => {
    expect(html).toContain("Mesita Partner");
    expect(html).toContain("yearly partnership");
    expect(html).toContain("Conservative");
    expect(html).toContain("Aggressive");
  });

  it("and a member DOES get the banner — the bijection", () => {
    const live = body("live", { place: place({ plan: "pro", plan_live_at: "2026-09-01T00:00:00Z" }) });
    expect(live).toContain("Honor guest checks");
  });
});

// The door is unbuilt: the one join door is `requireEditor`-guarded and
// never reads `organizations.partnered`, so wiring it under a paid tier
// would be a free plan=pro for any editor. A DISABLED primary button is the
// knob-that-pretends the house law forbids (SoonStrip.tsx) — the same law
// that leaves the Organization modal without a Continue button. One line.
describe("forfeited is one note and one line, never a button", () => {
  const owner = body("forfeited");
  const editor = body("forfeited", { isOwner: false });

  it("renders no button at all", () => {
    for (const html of [owner, editor]) {
      expect(html).not.toContain("<button");
      expect(html).not.toContain("Re-join this place");
    }
  });

  it("says when re-join lands, and whose action it is", () => {
    expect(owner).toContain("Re-join lands with the next release");
    expect(owner).toContain("the organization&#x27;s partnership is untouched");
    expect(editor).toContain("An owner re-joins this place");
    expect(editor).not.toContain("Re-join lands with the next release —");
  });

  it("keeps ONE forfeited note, and no banner over it", () => {
    // The banner's step 1 would read "Yearly — switch strategies anytime"
    // with a check, two lines above a red "forfeited" — the contradiction
    // the review caught.
    expect(owner).not.toContain("Honor guest checks");
    expect(owner.split("forfeited after 3 strikes").length - 1).toBe(1);
  });
});

// The partnership is not free any more, in any state this box can take.
describe("no state claims the partnership is free", () => {
  for (const state of ["not_member", "pending", "live", "paused", "forfeited", "review"] as const) {
    it(`${state} says free only about Zero`, () => {
      const html = body(state);
      const text = html.replace(/<[^>]*>/g, " ");
      for (const m of text.matchAll(/[^.!?]*\bfree\b[^.!?]*/gi)) {
        expect(m[0], `"${m[0].trim()}" in ${state}`).toContain("Zero");
      }
    });
  }
});
