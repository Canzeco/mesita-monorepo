import { describe, expect, it } from "vitest";
import {
  INITIAL_HISTORY_GUARD,
  reduceHistoryGuard,
} from "./historyGuard";

describe("reduceHistoryGuard", () => {
  it("pushes a sentinel when becoming dirty", () => {
    const r = reduceHistoryGuard(INITIAL_HISTORY_GUARD, { type: "dirty-on" });
    expect(r.state.trapping).toBe(true);
    expect(r.effects).toEqual(["push-sentinel"]);
  });

  it("does not double-push while already trapping", () => {
    const on = reduceHistoryGuard(INITIAL_HISTORY_GUARD, { type: "dirty-on" });
    const again = reduceHistoryGuard(on.state, { type: "dirty-on" });
    expect(again.effects).toEqual([]);
    expect(again.state.trapping).toBe(true);
  });

  it("reasserts and opens dialog on popstate while trapping", () => {
    const on = reduceHistoryGuard(INITIAL_HISTORY_GUARD, { type: "dirty-on" });
    const pop = reduceHistoryGuard(on.state, { type: "popstate" });
    expect(pop.state.dialogOpen).toBe(true);
    expect(pop.effects).toEqual(["reassert"]);
  });

  it("ignores popstate when not trapping", () => {
    const pop = reduceHistoryGuard(INITIAL_HISTORY_GUARD, { type: "popstate" });
    expect(pop.state).toEqual(INITIAL_HISTORY_GUARD);
    expect(pop.effects).toEqual([]);
  });

  it("clears trap on dirty-off", () => {
    const on = reduceHistoryGuard(INITIAL_HISTORY_GUARD, { type: "dirty-on" });
    const off = reduceHistoryGuard(on.state, { type: "dirty-off" });
    expect(off.state).toEqual(INITIAL_HISTORY_GUARD);
  });

  it("cancel-leave closes dialog but keeps trapping", () => {
    const on = reduceHistoryGuard(INITIAL_HISTORY_GUARD, { type: "dirty-on" });
    const pop = reduceHistoryGuard(on.state, { type: "popstate" });
    const cancel = reduceHistoryGuard(pop.state, { type: "cancel-leave" });
    expect(cancel.state.dialogOpen).toBe(false);
    expect(cancel.state.trapping).toBe(true);
  });

  it("confirm-leave arms allowNextPop and requests back", () => {
    const on = reduceHistoryGuard(INITIAL_HISTORY_GUARD, { type: "dirty-on" });
    const pop = reduceHistoryGuard(on.state, { type: "popstate" });
    const confirm = reduceHistoryGuard(pop.state, { type: "confirm-leave" });
    expect(confirm.state.allowNextPop).toBe(true);
    expect(confirm.effects).toEqual(["back"]);
  });

  it("allowNextPop consumes the next popstate cleanly", () => {
    const armed = {
      trapping: false,
      dialogOpen: false,
      allowNextPop: true,
    };
    const pop = reduceHistoryGuard(armed, { type: "popstate" });
    expect(pop.state).toEqual(INITIAL_HISTORY_GUARD);
    expect(pop.effects).toEqual([]);
  });
});
