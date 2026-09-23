// The closed chip says WHICH day (MESITA-2047).
//
// Scroll serves closed places now — the one live place, Dos Amores, is shut on
// Tuesdays — so "Closed · opens 08:30" gets read. Before this, that label at
// 07:00 on a Tuesday promised a table in ninety minutes at a place that would
// not open until Wednesday.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeOpenState,
  opensOnDay,
} from "@/lib/adapters/place-to-detail-helpers";
import { getOpeningStateLabel } from "@/lib/place-state";

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

function label() {
  const s = computeOpenState(DOS_AMORES, TZ);
  return getOpeningStateLabel({
    open_now: s.open_now,
    opens_at: s.opens_at || null,
    closes_at: s.closes_at || null,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("closed chip names the day", () => {
  it("Tuesday 07:00, shut all day → opens tomorrow", () => {
    at("2026-09-22T07:00:00");
    expect(label()).toBe("Closed · opens tomorrow 08:30");
  });

  it("Tuesday 21:54 (the screenshot) → opens tomorrow", () => {
    at("2026-09-22T21:54:00");
    expect(label()).toBe("Closed · opens tomorrow 08:30");
  });

  it("Monday 16:00, Tuesday shut → names Wednesday", () => {
    at("2026-09-21T16:00:00");
    expect(label()).toBe("Closed · opens Wed 08:30");
  });

  it("Wednesday 07:00 → later today stays a bare time", () => {
    at("2026-09-23T07:00:00");
    expect(label()).toBe("Closed · opens 08:30");
  });

  it("Wednesday noon → open until 15:00", () => {
    at("2026-09-23T12:00:00");
    expect(label()).toBe("Open · until 15:00");
  });

  it("a week out says next", () => {
    expect(opensOnDay(7, 2, "08:30")).toBe("next Tue 08:30");
    expect(opensOnDay(0, 2, "08:30")).toBe("08:30");
  });
});
