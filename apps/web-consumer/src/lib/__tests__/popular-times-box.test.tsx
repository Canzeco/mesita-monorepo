import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PopularTimesBox } from "@/components/consumer/place-detail/popular-times";
import type { PlaceDetail } from "@/lib/mock/place";

const withTimes = (popular_times: PlaceDetail["popular_times"]) =>
  ({ popular_times, timezone: "America/Monterrey" }) as unknown as PlaceDetail;

describe("Popular times on the place profile (MESITA-2135)", () => {
  it("renders nothing when enrichment wrote no popular times", () => {
    expect(renderToStaticMarkup(<PopularTimesBox place={withTimes([])} />)).toBe(
      "",
    );
  });

  it("shows the day picker and the busy range enrichment stores", () => {
    const html = renderToStaticMarkup(
      <PopularTimesBox
        place={withTimes([
          { day: "Monday", range: "7–9 PM", bars: [] },
          { day: "Tuesday", range: "8–10 PM", bars: [] },
        ])}
      />,
    );
    expect(html).toContain("Popular times");
    expect(html).toContain(">Mon<");
    expect(html).toContain(">Tue<");
    expect(html).toContain("Busiest");
    // No bars are stored today, so none are drawn — never invented zeros.
    expect(html).not.toMatch(/height:/);
  });

  it("draws bars only when a day carries them", () => {
    const html = renderToStaticMarkup(
      <PopularTimesBox
        place={withTimes([{ day: "Monday", range: "7–9 PM", bars: [0.2, 0.9] }])}
      />,
    );
    expect(html.match(/height:\s*\d/g)).toHaveLength(2);
  });
});
