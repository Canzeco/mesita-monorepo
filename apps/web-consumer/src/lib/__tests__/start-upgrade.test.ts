// MESITA-4393: one Checkout path for Me › Plan and the reserve flow (money).
import { beforeEach, describe, expect, it, vi } from "vitest";

const startPlan = vi.fn();
vi.mock("@/lib/api/plan", () => ({
  apiStartPlan: (...args: unknown[]) => startPlan(...args),
}));

import { EFError } from "@/lib/api/_invoke";
import { startUpgrade } from "@/lib/start-upgrade";

const client = {} as never;
const refusal = (code: string) =>
  new EFError("refused", { fn: "consumer-web-start-plan", code, status: 409 });

describe("startUpgrade", () => {
  beforeEach(() => { startPlan.mockReset(); });

  it("passes the caller's return URL through unchanged", async () => {
    startPlan.mockResolvedValue({ url: "https://checkout.stripe.com/x" });
    expect(await startUpgrade(client, "https://mesita.ai/me/plan")).toEqual({
      kind: "redirect",
      url: "https://checkout.stripe.com/x",
    });
    expect(startPlan).toHaveBeenCalledWith(client, "https://mesita.ai/me/plan");
  });

  it("maps resumed and already_pro", async () => {
    startPlan.mockResolvedValue({ resumed: true });
    expect(await startUpgrade(client, "u")).toEqual({ kind: "resumed" });
    startPlan.mockImplementation(async () => { throw refusal("already_pro"); });
    expect(await startUpgrade(client, "u")).toEqual({ kind: "already_pro" });
  });

  it("puts refusals in the guest's words", async () => {
    startPlan.mockImplementation(async () => { throw refusal("stripe_unavailable"); });
    expect(await startUpgrade(client, "u")).toEqual({
      kind: "error",
      message: "Payments are not available right now.",
    });
    startPlan.mockImplementation(async () => { throw new Error("network"); });
    expect(await startUpgrade(client, "u")).toEqual({
      kind: "error",
      message: "Couldn't open checkout. Try again.",
    });
  });
});
