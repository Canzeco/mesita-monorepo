// MESITA-4296: the Story sheet's look for the guest's story is money logic
// (Pay turns on only once a story was found) and a crash risk (a runaway
// loop of EF calls). Pinned: the look stops when the story is found, when
// the sheet closes and at the window's end; one loop at a time; focus
// restarts are debounced. And a GATE reason hides the Post step.
import { describe, expect, it } from "vitest";
import {
  createStoryPoll,
  isStoryGateReason,
  STORY_GATE_REASONS,
  storySheetView,
  type StoryCheckAnswer,
  type StoryCheckReason,
} from "./story-check";

const POLL = { every_ms: 5_000, for_ms: 120_000 };
const missing: StoryCheckAnswer = { kind: "missing", reason: "no_story", placeHandle: "probe", poll: POLL };
const found: StoryCheckAnswer = {
  kind: "found",
  mention: { id: "m1", media_url: null, media_kind: "image", mentioned_at: "2026-11-17T10:00:00Z", source: "emulator" },
  placeHandle: "probe",
  poll: POLL,
};

/** A fake clock and timer queue the loop runs on. */
function harness(answers: () => StoryCheckAnswer | Promise<StoryCheckAnswer>) {
  let t = 0;
  let id = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const log: StoryCheckAnswer[] = [];
  const looking: boolean[] = [];
  let calls = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  const poll = createStoryPoll({
    check: async () => {
      calls++;
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        return await answers();
      } finally {
        inFlight--;
      }
    },
    onAnswer: (a) => log.push(a),
    onLooking: (v) => looking.push(v),
    now: () => t,
    setTimer: (fn, ms) => {
      timers.set(++id, { at: t + ms, fn });
      return id;
    },
    clearTimer: (k) => void timers.delete(k as number),
    debounceMs: 600,
  });
  const flush = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  /** Moves the clock on, firing due timers in order. */
  const advance = async (ms: number) => {
    const end = t + ms;
    for (;;) {
      await flush();
      const due = [...timers.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      t = due[1].at;
      due[1].fn();
    }
    t = end;
    await flush();
  };
  return { poll, log, looking, advance, flush, calls: () => calls, maxInFlight: () => maxInFlight, pending: () => timers.size };
}

describe("the Story look (createStoryPoll)", () => {
  it("stops when the story is found", async () => {
    let n = 0;
    const h = harness(() => (++n >= 3 ? found : missing));
    h.poll.start(POLL);
    await h.advance(60_000);
    expect(h.calls()).toBe(3);
    expect(h.log.at(-1)?.kind).toBe("found");
    expect(h.poll.looking).toBe(false);
    expect(h.pending()).toBe(0);
  });

  it("stops at the window's end", async () => {
    const h = harness(() => missing);
    h.poll.start(POLL);
    await h.advance(10 * 60_000);
    // A check at 0, 5 s … 120 s: 25 checks, none after the window.
    expect(h.calls()).toBe(25);
    expect(h.poll.looking).toBe(false);
    expect(h.looking).toEqual([true, false]);
  });

  it("stops when the sheet closes, and reports nothing after", async () => {
    let release: (a: StoryCheckAnswer) => void = () => {};
    const h = harness(() => new Promise<StoryCheckAnswer>((r) => (release = r)));
    h.poll.start(POLL);
    await h.flush();
    h.poll.close();
    release(found);
    await h.advance(60_000);
    expect(h.calls()).toBe(1);
    expect(h.log).toEqual([]);
    h.poll.start(POLL);
    expect(h.calls()).toBe(1);
  });

  it("keeps looking through a failed check (never no_story)", async () => {
    let n = 0;
    const h = harness(() => {
      n++;
      if (n === 1) throw new Error("500 check_failed");
      return n === 2 ? { kind: "failed" } : found;
    });
    h.poll.start(POLL);
    await h.advance(20_000);
    expect(h.log.map((a) => a.kind)).toEqual(["failed", "failed", "found"]);
  });

  it("runs one loop at a time: a restart never doubles a check in flight", async () => {
    let release: (a: StoryCheckAnswer) => void = () => {};
    const h = harness(() => new Promise<StoryCheckAnswer>((r) => (release = r)));
    h.poll.start(POLL);
    await h.flush();
    h.poll.start(POLL);
    h.poll.start(POLL);
    expect(h.calls()).toBe(1);
    release(missing);
    await h.flush();
    // The newest loop's first check, once the old one answered.
    expect(h.calls()).toBe(2);
    expect(h.maxInFlight()).toBe(1);
    release(missing);
    await h.flush();
    // Only one timer chain is alive.
    expect(h.pending()).toBe(1);
  });

  it("debounces restarts from focus and visibilitychange", async () => {
    const h = harness(() => missing);
    h.poll.restart();
    h.poll.restart();
    h.poll.restart();
    await h.advance(599);
    expect(h.calls()).toBe(0);
    await h.advance(1);
    expect(h.calls()).toBe(1);
    expect(h.poll.looking).toBe(true);
  });

  it("restarts after the window ended", async () => {
    const h = harness(() => missing);
    h.poll.start(POLL);
    await h.advance(10 * 60_000);
    const before = h.calls();
    h.poll.restart();
    await h.advance(600);
    expect(h.calls()).toBe(before + 1);
    expect(h.poll.looking).toBe(true);
  });
});

describe("the gate (storySheetView)", () => {
  it("a gate reason hides the Post step", () => {
    for (const reason of STORY_GATE_REASONS) {
      const v = storySheetView({ kind: "missing", reason, placeHandle: null, poll: POLL }, false);
      expect(v.step).toBe("gate");
      expect("showPost" in v && v.showPost).toBe(false);
    }
  });

  it("no_story and story_too_old keep the Post step", () => {
    for (const reason of ["no_story", "story_too_old"] as StoryCheckReason[]) {
      expect(isStoryGateReason(reason)).toBe(false);
      const v = storySheetView({ kind: "missing", reason, placeHandle: null, poll: POLL }, false);
      expect(v.step).toBe("post");
      expect("showPost" in v && v.showPost).toBe(true);
    }
  });

  it("a failed check keeps the Post step and never reads as a gate", () => {
    expect(storySheetView({ kind: "failed" }, true).step).toBe("post");
  });

  it("only a found story leaves the check step for Pay", () => {
    expect(storySheetView(found, false).step).toBe("found");
    expect(storySheetView(null, false).step).toBe("checking");
  });

  it("a gate seen once stays even when a later poll (gate skipped) says no_story", () => {
    expect(storySheetView(missing, false, "private_account").step).toBe("gate");
  });
});
