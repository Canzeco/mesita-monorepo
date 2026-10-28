import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HoursBox } from "./components/place-detail/location-hours";
import { placeRowToDetail } from "./place-to-detail";
import { computeOpenState } from "./place-to-detail-helpers";

// Open state can be unknown (MESITA-2331): no hours, or no timezone and no
// word from Google, says nothing — never "Closed", never a guess in UTC.

const ALL_DAY = { open: "00:00", close: "23:59" };
const OPEN_ALWAYS = Object.fromEntries(
  ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    .map((day) => [day, [ALL_DAY]]),
);

function row(over: Record<string, unknown> = {}) {
  return placeRowToDetail({
    id: "p-1",
    name: "Lupita",
    category_label: "Restaurant",
    ...over,
  });
}

describe("computeOpenState", () => {
  it("is unknown without hours", () => {
    expect(computeOpenState({}, "America/Mexico_City").open_now).toBeNull();
  });

  it("is unknown without a timezone instead of guessing in UTC", () => {
    expect(computeOpenState(OPEN_ALWAYS, undefined)).toEqual({
      open_now: null,
      opens_at: "",
      closes_at: "",
    });
    expect(computeOpenState(OPEN_ALWAYS, "  ").open_now).toBeNull();
  });

  it("reads the hours in the place's timezone", () => {
    expect(computeOpenState(OPEN_ALWAYS, "America/Mexico_City").open_now)
      .toBe(true);
  });
});

describe("placeRowToDetail open_now", () => {
  it("takes Google's open-now when the row has no timezone", () => {
    expect(row({ open_now: true }).open_now).toBe(true);
    expect(row({ hours: OPEN_ALWAYS, open_now: false }).open_now).toBe(false);
  });

  it("stays null with no hours, no timezone and no word from Google", () => {
    expect(row().open_now).toBeNull();
    expect(row({ hours: OPEN_ALWAYS }).open_now).toBeNull();
  });

  it("lets the place's own hours win over Google when it has a timezone", () => {
    expect(
      row({ hours: OPEN_ALWAYS, timezone: "America/Mexico_City", open_now: false })
        .open_now,
    ).toBe(true);
  });
});

describe("HoursBox", () => {
  // The open line lives in the facts row only (MESITA-2911); the box is the week.
  it("draws nothing without weekly hours, even with a known open state", () => {
    expect(renderToStaticMarkup(<HoursBox place={row({ open_now: false })} />))
      .toBe("");
  });

  it("highlights no day as today without a timezone", () => {
    const html = renderToStaticMarkup(<HoursBox place={row({ hours: OPEN_ALWAYS })} />);
    expect(html).toContain("Monday");
    expect(html).not.toContain("data-today");
  });

  it("highlights today when the place has a timezone, and prints no open line", () => {
    const html = renderToStaticMarkup(
      <HoursBox place={row({ hours: OPEN_ALWAYS, timezone: "America/Mexico_City" })} />,
    );
    expect(html).toContain("data-today");
    expect(html).not.toContain(">Open<");
    expect(html).not.toContain("until");
  });
});
