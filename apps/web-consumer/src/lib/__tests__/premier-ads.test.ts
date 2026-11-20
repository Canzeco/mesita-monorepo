import { describe, expect, it } from "vitest";
import { rememberAd } from "@/lib/premier-ads";

describe("rememberAd", () => {
  it("reports a place once per kind in a tab", () => {
    const once = rememberAd([], "p", "impression");
    expect(once).toEqual(["impression:p"]);
    expect(rememberAd(once!, "p", "impression")).toBeNull();
    expect(rememberAd(once!, "p", "tap")).toEqual(["impression:p", "tap:p"]);
  });
});
