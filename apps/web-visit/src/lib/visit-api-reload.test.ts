// Money (MESITA-4264): a staff page older than the server gets 409 `reload`
// (the old activate stub, a body without a decision). The client reads that
// code before any status rule, so it says "Reload this page", never "this
// voucher is not valid", and a 404 gone still reads as not valid.
import { afterEach, describe, expect, it, vi } from "vitest";
import { getStory, VisitError } from "./visit-api";

function answer(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

async function refusal(): Promise<VisitError> {
  try {
    await getStory("0".repeat(32));
  } catch (e) {
    return e as VisitError;
  }
  throw new Error("expected a refusal");
}

afterEach(() => vi.unstubAllGlobals());

describe("call() and the reload answer", () => {
  it("reads code reload first, whatever the status", async () => {
    for (const status of [409, 400, 404]) {
      answer(status, { ok: false, code: "reload", error: "This page changed. Reload it." });
      const e = await refusal();
      expect(e.code).toBe("reload");
      expect(e.invalid).toBe(false);
    }
  });

  it("still reads gone as not valid", async () => {
    answer(404, { ok: false, code: "gone", error: "x" });
    const e = await refusal();
    expect(e.invalid).toBe(true);
  });
});
