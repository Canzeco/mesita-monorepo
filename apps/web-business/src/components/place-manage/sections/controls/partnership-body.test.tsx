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
  over: {
    isOwner?: boolean;
    place?: AdminPlace;
    /** PRESENT ⇒ this caller may write. PromosSection passes a handler only
     *  for an owner of a place it has READ as `partnered`; this box never
     *  decides that for itself. */
    onRejoin?: () => void;
    rejoinPending?: boolean;
    rejoinError?: string | null;
  } = {},
) {
  return renderToStaticMarkup(
    <PartnershipBody
      place={over.place ?? place(pillState === "not_member" ? {} : { plan: "pro" })}
      pillState={pillState}
      storedStrategy={null}
      member={pillState !== "not_member" && pillState !== "forfeited"}
      setupHref="/places/p-1/products/pay"
      isOwner={over.isOwner ?? true}
      onRejoin={over.onRejoin}
      rejoinPending={over.rejoinPending}
      rejoinError={over.rejoinError}
    />,
  );
}

/** A caller who may write. The handler itself never fires under
 *  `renderToStaticMarkup`; its PRESENCE is the permission. */
const MAY_WRITE = () => {};

// The first cut rendered the three-step banner in every state, so a place
// that had never subscribed read the same door three times in eight lines:
// the page's top line, the banner's step 1 ("Subscribe — yearly…"), then the
// pitch. The banner is for a place that is IN; the pitch is what a non-member
// needs.
describe("a non-member gets the pitch alone", () => {
  const html = body("not_member");

  it("no lifecycle banner, so the door is not repeated", () => {
    expect(html).not.toContain("Subscribe");
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

// MESITA-1891 built the door. MESITA-1889 had already guarded it — the join
// refuses unless the PLACE is `partnered` and the caller OWNS it — which is
// what made a button safe to render at all; before that it would have handed
// any editor a free plan=pro under a paid tier. The permission arrives as a
// HANDLER, not as a boolean, so "may write" and "has a button" cannot drift
// apart. And there is still no disabled primary button: a knob that pretends
// is what the house law forbids (SoonStrip.tsx).
describe("forfeited offers the door to whoever may open it", () => {
  const writer = body("forfeited", { onRejoin: MAY_WRITE });
  const editor = body("forfeited", { isOwner: false });
  const readOnlyOwner = body("forfeited");

  // THE BIJECTION. A handler means a button; no handler means no button, in
  // both of the two ways a caller can lack one.
  it("a caller who may write gets the button; one who may not never does", () => {
    expect(writer).toContain("<button");
    expect(writer).toContain("Re-join this place");
    for (const html of [editor, readOnlyOwner]) {
      expect(html).not.toContain("<button");
      expect(html).not.toContain("Re-join this place");
    }
  });

  it("says what re-joining does, and nothing about a next release", () => {
    for (const html of [writer, editor, readOnlyOwner]) {
      expect(html).toContain("the yearly subscription is untouched");
      expect(html).toContain("clears the strikes and the forfeit");
      expect(html).not.toContain("next release");
      expect(html).not.toContain("lands with");
    }
    // A caller who may not write keeps the sentence naming who can — and the
    // one who may does not read it, because the button IS the answer.
    expect(editor).toContain("An owner re-joins this place.");
    expect(writer).not.toContain("An owner re-joins this place.");
  });

  it("the button is busy, never disabled-and-silent, and never fakes a press", () => {
    const busy = body("forfeited", { onRejoin: MAY_WRITE, rejoinPending: true });
    expect(busy).toContain("Re-joining…");
    expect(busy).toContain("disabled");
    expect(writer).not.toContain("disabled");
  });

  it("a failed join lands beside the button, in operator words", () => {
    const failed = body("forfeited", {
      onRejoin: MAY_WRITE,
      rejoinError: "Couldn't re-join this place. Nothing changed — try again.",
    });
    expect(failed).toContain("Nothing changed");
    // Always-mounted live region: one that appears with its message does not
    // announce.
    expect(writer).toContain('aria-live="polite"');
  });

  // A DROPPED place — out of the partnership while the Membership is live —
  // reads not_member with no forfeit stamp, and it is the same door.
  it("a dropped place gets the same door, with its own sentence", () => {
    const dropped = body("not_member", { onRejoin: MAY_WRITE });
    expect(dropped).toContain("Re-join this place");
    expect(dropped).toContain("puts this place back in the partnership");
    expect(dropped).not.toContain("clears the strikes");
    // And a plain non-member, with nothing bought, is offered nothing.
    expect(body("not_member")).not.toContain("Re-join this place");
  });

  it("keeps ONE forfeited note, and no banner over it", () => {
    const owner = readOnlyOwner;
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
