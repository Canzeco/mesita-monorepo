// Money (MESITA-3304): the request id decides whether a retry replays the
// payment that went through or pays again. A kept id with a new amount reads
// `taken`; a fresh id after a lost answer can pay twice.
import { describe, expect, it } from "vitest";
import { attemptFor } from "@/lib/api/wallet";

let n = 0;
const mint = () => `id-${++n}`;

describe("attemptFor", () => {
  it("keeps the id for the same place and amount (a retry)", () => {
    const a = attemptFor(null, "p1", 5000, mint);
    expect(attemptFor(a, "p1", 5000, mint)).toBe(a);
  });

  it("mints a fresh id when the amount or the place changes", () => {
    const a = attemptFor(null, "p1", 5000, mint);
    expect(attemptFor(a, "p1", 5001, mint).requestId).not.toBe(a.requestId);
    expect(attemptFor(a, "p2", 5000, mint).requestId).not.toBe(a.requestId);
  });

  it("mints a fresh id after the page drops it (an answer with a code)", () => {
    const a = attemptFor(null, "p1", 5000, mint);
    expect(attemptFor(null, "p1", 5000, mint).requestId).not.toBe(a.requestId);
  });
});
