// MESITA-4405: the Story screen's poll is a crash risk (a runaway loop of EF
// calls). Pinned: it asks every 5 s, every 15 s after 2 minutes, and stops
// at approved, void, the deadline, or with no hint from the server.
import { describe, expect, it } from "vitest";
import { storyPollDelay } from "@/lib/story-ticket";

const POLL = { every_ms: 5_000, slow_after_ms: 120_000, slow_every_ms: 15_000 };
const T0 = Date.parse("2026-11-18T20:00:00Z");
const s = (state: "waiting_post" | "found" | "approved" | "released" | "void", over: Partial<{ poll: typeof POLL | null; deadline_at: string }> = {}) => ({
  state,
  poll: POLL as typeof POLL | null,
  deadline_at: "2026-11-19T08:00:00Z",
  ...over,
});

describe("storyPollDelay", () => {
  it("every 5 s, then every 15 s after 2 minutes", () => {
    expect(storyPollDelay(s("waiting_post"), T0, T0 + 1_000)).toBe(5_000);
    expect(storyPollDelay(s("found"), T0, T0 + 119_000)).toBe(5_000);
    expect(storyPollDelay(s("found"), T0, T0 + 120_000)).toBe(15_000);
  });
  it("stops at released, void, or no hint; the server's hint alone keeps an approved or late Story polled", () => {
    expect(storyPollDelay(s("released"), T0, T0)).toBeNull();
    expect(storyPollDelay(s("void"), T0, T0)).toBeNull();
    expect(storyPollDelay(s("waiting_post", { poll: null }), T0, T0)).toBeNull();
    expect(storyPollDelay(s("approved", { poll: null }), T0, T0)).toBeNull();
    expect(storyPollDelay(null, T0, T0)).toBeNull();
    // MESITA-4426: near its bonus an approved Story is asked every 5 s, and
    // one more look past the deadline lets the server end the Story.
    expect(storyPollDelay(s("approved"), T0, T0)).toBe(POLL.every_ms);
    expect(storyPollDelay(s("waiting_post", { deadline_at: "2026-11-18T19:59:00Z" }), T0, T0)).toBe(POLL.every_ms);
  });
  it("never faster than 1 s, whatever the server says", () => {
    expect(storyPollDelay(s("found", { poll: { ...POLL, every_ms: 10 } }), T0, T0)).toBe(1_000);
  });
});
