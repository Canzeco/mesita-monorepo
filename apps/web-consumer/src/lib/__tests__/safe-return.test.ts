import { describe, expect, it } from "vitest";
import { safeReturn } from "@/lib/navigate";

describe("safeReturn", () => {
  it("keeps one absolute path on this site", () => {
    expect(safeReturn("/wallet/cards/new")).toBe("/wallet/cards/new");
    expect(safeReturn("/pay/place/place-1")).toBe("/pay/place/place-1");
  });

  it("drops a return that leaves the site", () => {
    expect(safeReturn("//evil.com")).toBeNull();
    expect(safeReturn("/%2F%2Fevil.com")).toBeNull();
    expect(safeReturn("/\\evil.com")).toBeNull();
    expect(safeReturn("https://evil.com/home")).toBeNull();
    expect(safeReturn("javascript:alert(1)")).toBeNull();
    expect(safeReturn(null)).toBeNull();
  });
});
