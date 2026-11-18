// MESITA-4393: the reserve flow's plan rules. Money path: Pro is offered
// only when it would unblock the guest, the form never blocks on a lifted
// cap or an old Edge Function, and the way back from Checkout lands right.
import { describe, expect, it } from "vitest";

import type { GuestPlanView } from "@/lib/api/plan";
import {
  blocked,
  capApplies,
  decodeDraft,
  DRAFT_TTL_MS,
  encodeDraft,
  offerPro,
  proReturnUrl,
  returnOutcome,
  type ReserveDraft,
} from "@/lib/reserve-plan";

const view = (over: Partial<GuestPlanView> = {}): GuestPlanView => ({
  plan: "free",
  granted: false,
  cap: 3,
  used: 3,
  price_cents: 100,
  currency: "usd",
  paid_until: null,
  cancel_at_period_end: false,
  cap_lifted: false,
  cap_override: false,
  ...over,
});

describe("offerPro", () => {
  it("offers Pro to a Free guest with none left and no operator cap", () => {
    expect(offerPro(view())).toBe(true);
    expect(offerPro(view({ used: 9 }))).toBe(true);
  });
  it("never offers Pro when Pro would not help", () => {
    expect(offerPro(view({ plan: "premium", cap: 10, used: 10 }))).toBe(false);
    expect(offerPro(view({ plan: "premium", granted: true, cap: 10, used: 10 }))).toBe(false);
    expect(offerPro(view({ cap_override: true }))).toBe(false);
    expect(offerPro(view({ used: 10 }))).toBe(false);
    expect(offerPro(view({ used: 2 }))).toBe(false);
    expect(offerPro(view({ cap_lifted: true }))).toBe(false);
  });
  it("fails open when the server did not send the flags", () => {
    const old = view();
    delete old.cap_lifted;
    delete old.cap_override;
    expect(offerPro(old)).toBe(false);
    expect(blocked(old)).toBe(false);
    expect(capApplies({ view: old, checking: false, hasLiveTable: false })).toBe(false);
  });
});

describe("blocked and capApplies", () => {
  it("is blocked at zero left unless the cap is lifted", () => {
    expect(blocked(view())).toBe(true);
    expect(blocked(view({ cap_lifted: true }))).toBe(false);
    expect(blocked(view({ used: 1 }))).toBe(false);
  });
  it("applies only after the duplicate check and without a live table", () => {
    expect(capApplies({ view: view(), checking: false, hasLiveTable: false })).toBe(true);
    expect(capApplies({ view: view(), checking: true, hasLiveTable: false })).toBe(false);
    expect(capApplies({ view: view(), checking: false, hasLiveTable: true })).toBe(false);
    expect(capApplies({ view: null, checking: false, hasLiveTable: false })).toBe(false);
  });
});

describe("proReturnUrl", () => {
  it("keeps other params, sets pro=1 and drops an old plan id", () => {
    expect(proReturnUrl("https://mesita.ai/place/abc/reserve")).toBe(
      "https://mesita.ai/place/abc/reserve?pro=1",
    );
    expect(
      proReturnUrl("https://mesita.ai/place/abc/reserve?from=home&plan=cs_old"),
    ).toBe("https://mesita.ai/place/abc/reserve?from=home&pro=1");
  });
});

describe("draft", () => {
  const now = 1_800_000_000_000;
  const draft: ReserveDraft = {
    savedAt: now - 1000,
    dateChoice: "2026-11-20",
    timeChoice: "20:00",
    timeWindow: 30,
    party: 4,
    notes: "window seat",
    firstName: "Ana",
    lastName: "Ruiz",
    onConfirm: "app",
    onReject: "call",
    stepAt: 2,
  };
  it("round-trips", () => {
    expect(decodeDraft(encodeDraft(draft), now)).toEqual(draft);
  });
  it("drops stale, future, malformed and out-of-range drafts without throwing", () => {
    expect(decodeDraft(encodeDraft({ ...draft, savedAt: now - DRAFT_TTL_MS - 1 }), now)).toBeNull();
    expect(decodeDraft(encodeDraft({ ...draft, savedAt: now + 60_000 }), now)).toBeNull();
    expect(decodeDraft("{not json", now)).toBeNull();
    expect(decodeDraft("null", now)).toBeNull();
    expect(decodeDraft(null, now)).toBeNull();
    expect(decodeDraft(encodeDraft({ ...draft, party: 0 }), now)).toBeNull();
    expect(decodeDraft(JSON.stringify({ ...draft, firstName: 7 }), now)).toBeNull();
  });
});

describe("returnOutcome", () => {
  const base = { hasProMarker: true, sessionId: null as string | null, view: view(), readFailed: false };
  it("is nothing without the marker or a session", () => {
    expect(returnOutcome({ ...base, hasProMarker: false })).toEqual({ kind: "none" });
  });
  it("reads the payment verdict on a session return", () => {
    const s = { ...base, sessionId: "cs_1" };
    expect(returnOutcome({ ...s, view: view({ plan: "premium", cap: 10, confirmed: "paid" }) })).toEqual({ kind: "paid" });
    expect(returnOutcome({ ...s, view: view({ confirmed: "pending" }) })).toEqual({ kind: "pending" });
    expect(returnOutcome({ ...s, readFailed: true, view: null })).toEqual({ kind: "check_failed" });
    expect(returnOutcome({ ...s, view: view({ plan: "premium", cap: 10 }) })).toEqual({ kind: "paid" });
    expect(returnOutcome({ ...s, view: view() })).toEqual({ kind: "check_failed" });
  });
  it("offers Pro again after a cancel only while Pro still helps", () => {
    expect(returnOutcome(base)).toEqual({ kind: "offer" });
    expect(returnOutcome({ ...base, view: view({ plan: "premium", cap: 10, used: 4 }) })).toEqual({ kind: "form" });
  });
});
