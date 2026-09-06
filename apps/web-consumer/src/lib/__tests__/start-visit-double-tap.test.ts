// MESITA-1597 — two taps must never open two tickets.
//
// Tap place A, tap place B before A resolves, and before this fix both taps
// dispatched: two apiCreateTicket calls, two real tickets, two racing
// router.push. Nothing downstream caught it. The server's `already_open` guard
// is PER-PLACE, so a second, DIFFERENT place sails through, and `activeTickets`
// cannot hold the in-flight ticket because it only refreshes via onCreated,
// after the create returns.
//
// WHY THIS IS A SOURCE-CONTRACT TEST. The guard lives inside a React hook and a
// component, and this repo has no renderHook (no @testing-library/react, and
// adding one to pin two lines is not worth a dependency). The idiom already in
// use here is to read the source and pin the invariant — same mechanism as
// ticket-journey-drift.test.ts, which also notes that mobile has no test runner
// at all, so a pin on this side is the only coverage the mobile twin gets.
//
// The two assertions that matter are about SHAPE, not spelling:
//   1. the latch is a REF, never `startingId` state
//   2. the rows disable on ANY create, never on their own `busy`
// Both are the exact mistakes a well-meaning re-fix would reintroduce.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");

const read = (p: string) => readFileSync(join(REPO_ROOT, p), "utf8");

const HOOK = read("apps/web-consumer/src/lib/hooks/useStartVisit.ts");
const WEB_LIST = read(
  "apps/web-consumer/src/components/consumer/rewards/PlacePickList.tsx",
);
const MOBILE_LIST = read(
  "apps/mobile-consumer/src/components/rewards/PlacePickList.tsx",
);

describe("useStartVisit — the in-flight latch", () => {
  it("latches on a ref, because a state read is one render too late", () => {
    // Two taps arrive in two separate event handlers. A setState from the first
    // is not visible to the second until React re-renders, which on a real
    // double-tap has not happened yet — so `startingId !== null` still reads
    // null and both taps dispatch. Only a ref updates synchronously.
    expect(HOOK).toMatch(/useRef/);
    expect(HOOK).toMatch(/const inFlight = useRef\(false\)/);
    expect(HOOK).toMatch(/if \(inFlight\.current\) return;/);

    // The bug's shape, pinned so it cannot come back as a "simplification":
    // guarding on the state variable instead of the ref.
    expect(HOOK).not.toMatch(/if \(startingId (!==|!=) null\) return/);
  });

  it("sets the latch before the first await and clears it in finally", () => {
    // Set synchronously at the top of startTicket: by the time `void
    // startTicket(place)` returns to pickPlace, the latch is already up, so a
    // tap landing a millisecond later sees it.
    const start = HOOK.indexOf("inFlight.current = true");
    const firstAwait = HOOK.indexOf("await apiCreateTicket");
    expect(start).toBeGreaterThan(-1);
    expect(firstAwait).toBeGreaterThan(-1);
    expect(start).toBeLessThan(firstAwait);

    // Cleared in `finally`, not on the success path — an error must not leave
    // the picker permanently dead.
    expect(HOOK).toMatch(/finally \{\s*inFlight\.current = false;/);
  });

  it("drops the tap ahead of the existing-ticket branch", () => {
    // Order is load-bearing. The existing-ticket branch NAVIGATES, and a second
    // router.push racing the in-flight create's own push is the other half of
    // this bug — so the latch has to win before that branch is reached.
    const guard = HOOK.indexOf("if (inFlight.current) return;");
    const existingBranch = HOOK.indexOf("activeTickets.find");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(existingBranch);
  });
});

describe("PlacePickList — every row goes inert, not just the busy one", () => {
  // `busy` is per-row (`busyPlaceId === row.id`). The second tap of a
  // double-tap lands on a DIFFERENT row, which is not the busy one, so
  // `disabled={busy}` would let it straight through. It has to be anyBusy.
  for (const [name, src] of [
    ["web", WEB_LIST],
    ["mobile", MOBILE_LIST],
  ] as const) {
    it(`${name}: disables on anyBusy, wired from busyPlaceId`, () => {
      expect(src).toMatch(/anyBusy=\{busyPlaceId !== null\}/);
      expect(src).toMatch(/disabled=\{anyBusy\}/);
      expect(src).not.toMatch(/disabled=\{busy\}/);
    });
  }
});
