// MVP test rule (MESITA-2600): only the auth guard stays.
import { describe, expect, it } from "vitest";
import { dmVerified } from "@/lib/api/profile";

// MESITA-4858: only the server's proof, for this handle, with the code spent.
describe("verifying Instagram by message", () => {
  const ok = { status: "none" as const, handle: "vale", provedAt: "2026-11-24T12:00:00Z", vipStatus: null };
  it("needs the code spent, the proof and the same handle", () => {
    expect(dmVerified(ok, "vale")).toBe(true);
    expect(dmVerified({ ...ok, status: "pending" }, "vale")).toBe(false);
    expect(dmVerified({ ...ok, status: "wrong_account" }, "vale")).toBe(false);
    expect(dmVerified({ ...ok, provedAt: null }, "vale")).toBe(false);
    expect(dmVerified(ok, "someone.else")).toBe(false);
  });
});
