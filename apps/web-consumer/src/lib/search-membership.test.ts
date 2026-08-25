import { describe, expect, it } from "vitest";

import {
  membershipColor,
  membershipTone,
  placeMembershipTone,
} from "@/lib/search-membership";

describe("search membership tones", () => {
  it("maps partner / listed / google-only", () => {
    expect(membershipTone({ status: "web_listed", partner: true })).toBe(
      "partner",
    );
    expect(membershipTone({ status: "web_listed", partner: false })).toBe(
      "listed",
    );
    expect(
      membershipTone({ status: "not_in_mesita", partner: true }),
    ).toBe("google");
    expect(placeMembershipTone({ partner: true })).toBe("partner");
    expect(placeMembershipTone({ partner: false })).toBe("listed");
    expect(placeMembershipTone({ plan: "pro" })).toBe("partner");
  });

  it("uses Mesita pink, a true gray, and a map-readable yellow", () => {
    expect(membershipColor("partner")).toBe("#fb2b7b");
    expect(membershipColor("listed")).toBe("#9ca3af");
    expect(membershipColor("google")).toBe("#EAB308");
  });
});
