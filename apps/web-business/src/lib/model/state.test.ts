// Organization state and place state are different things about different
// entities, and the console conflated them once already: it rendered the
// place ladder (Listed → Verified → Partner) as the ORGANIZATION's state.
// These tests exist so that cannot come back silently.
import { describe, expect, it } from "vitest";
import { organizationState } from "./format";
import type { PaymentAccountState } from "./types";

describe("organizationState", () => {
  it("is Connected only when money can both land and leave", () => {
    expect(organizationState("live")).toBe("connected");
  });

  it("is Not connected for every state short of live", () => {
    const shortOfLive: PaymentAccountState[] = [
      "none",
      "pending",
      "charges_only",
      "restricted",
    ];
    for (const s of shortOfLive) {
      expect(organizationState(s)).toBe("not_connected");
    }
  });

  it("treats charges_only as not connected — money lands but cannot leave", () => {
    expect(organizationState("charges_only")).toBe("not_connected");
  });

  it("treats restricted as not connected — Stripe paused it", () => {
    expect(organizationState("restricted")).toBe("not_connected");
  });
});
