import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HoursSection, weekFromToday } from "./components/place-detail/location-hours";
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
    mesita_name: "Lupita",
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

describe("HoursSection", () => {
  it("prints neither Open nor Closed when the state is unknown", () => {
    const html = renderToStaticMarkup(<HoursSection place={row()} />);
    expect(html).not.toContain(">Closed<");
    expect(html).not.toContain(">Open<");
  });

  it("prints Closed only when the place is known to be closed", () => {
    const html = renderToStaticMarkup(<HoursSection place={row({ open_now: false })} />);
    expect(html).toContain(">Closed<");
  });

  it("highlights no day as today without a timezone", () => {
    const html = renderToStaticMarkup(<HoursSection place={row({ hours: OPEN_ALWAYS })} />);
    expect(html).toContain("Monday");
    expect(html).not.toContain("bg-muted/80");
  });

  it("highlights today when the place has a timezone", () => {
    const html = renderToStaticMarkup(
      <HoursSection place={row({ hours: OPEN_ALWAYS, timezone: "America/Mexico_City" })} />,
    );
    expect(html).toContain("bg-muted/80");
    expect(html).toContain(">Open<");
    expect(html).toContain("(today)");
  });

  it("is collapsible, closed by default (MESITA-2441)", () => {
    const html = renderToStaticMarkup(
      <HoursSection place={row({ hours: OPEN_ALWAYS, timezone: "America/Mexico_City" })} />,
    );
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
    expect(html).toContain("Show week");
  });

  it("draws nothing with no hours and an unknown state", () => {
    expect(renderToStaticMarkup(<HoursSection place={row()} />)).toBe("");
  });
});

describe("weekFromToday", () => {
  const week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    .map((day) => ({ day, range: "9–5" }));

  it("puts today first and keeps the order after it", () => {
    expect(weekFromToday(week, "Thursday").map((d) => d.day)).toEqual([
      "Thursday", "Friday", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday",
    ]);
  });

  it("keeps the stored order when today is unknown", () => {
    expect(weekFromToday(week, "")).toEqual(week);
  });
});
