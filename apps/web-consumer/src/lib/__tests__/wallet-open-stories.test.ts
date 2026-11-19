// MESITA-4446: a decided Story (void, released) never stays on the Wallet,
// where it was a row nobody could dismiss and blocked Remove on its place's
// Loyalty Card (a card the guest could not delete). Open ones stay.
import { describe, expect, it } from "vitest";
import { openStories } from "@/lib/story-lines";

describe("openStories", () => {
  it("keeps waiting and checking, drops released and void", () => {
    const list = (["waiting", "checking", "released", "void"] as const).map((state) => ({ state, id: state }));
    expect(openStories(list).map((s) => s.id)).toEqual(["waiting", "checking"]);
  });

  it("an empty or all-decided list is empty, so Remove is not blocked", () => {
    expect(openStories([])).toEqual([]);
    expect(openStories([{ state: "void" as const }, { state: "released" as const }])).toEqual([]);
  });
});
