// The next opening names WHICH day (MESITA-2047).
//
// The one live place then, Dos Amores, is shut on Tuesdays. Before this, 07:00 on
// a Tuesday read "opens 08:30", ninety minutes away, at a place that would not
// open until Wednesday. The chips now say only Open or Closed (MESITA-3229); the
// data keeps the day for whichever screen prints it next.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeOpenState,
  opensOnDay,
} from "./place-to-detail-helpers";

const DOS_AMORES = Object.fromEntries(
  ["monday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(
    (d) => [d, [{ open: "08:30", close: "15:00" }]],
  ),
);
const TZ = "America/Mexico_City"; // UTC−6, no DST since 2022

/** Local wall-clock in Mexico City → the UTC instant. */
function at(isoLocal: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${isoLocal}-06:00`));
}

function opensAt() {
  return computeOpenState(DOS_AMORES, TZ).opens_at;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the next opening names the day", () => {
  it("Tuesday 07:00, shut all day → opens tomorrow", () => {
    at("2026-09-22T07:00:00");
    expect(opensAt()).toBe("tomorrow 08:30");
  });

  it("Tuesday 21:54 (the screenshot) → opens tomorrow", () => {
    at("2026-09-22T21:54:00");
    expect(opensAt()).toBe("tomorrow 08:30");
  });

  it("Monday 16:00, Tuesday shut → names Wednesday", () => {
    at("2026-09-21T16:00:00");
    expect(opensAt()).toBe("Wed 08:30");
  });

  it("Wednesday 07:00 → later today stays a bare time", () => {
    at("2026-09-23T07:00:00");
    expect(opensAt()).toBe("08:30");
  });

  it("Wednesday noon → open until 15:00", () => {
    at("2026-09-23T12:00:00");
    const s = computeOpenState(DOS_AMORES, TZ);
    expect(s.open_now).toBe(true);
    expect(s.closes_at).toBe("15:00");
  });

  it("a week out says next", () => {
    expect(opensOnDay(7, 2, "08:30")).toBe("next Tue 08:30");
    expect(opensOnDay(0, 2, "08:30")).toBe("08:30");
  });
});
