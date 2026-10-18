import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlaceOpensCard } from "./PlaceOpensCard";

const report = {
  ok: true as const,
  windowDays: 30,
  capped: false,
  summary: {
    opens: 6,
    byOutcome: { existing: 2, created: 2, refused: 1, failed: 1 },
    places: 3,
    profileRate: 4 / 6,
    repeated: [{ googlePlaceId: "a", opens: 3, created: true, placeId: "p-a" }],
  },
  names: { a: "La Cantina" },
};

describe("Opens from Google (MESITA-2323)", () => {
  it("shows opens by outcome, the profile rate and repeated places by name", () => {
    const html = renderToStaticMarkup(<PlaceOpensCard report={report} />);
    expect(html).toContain("Opens from Google");
    expect(html).toContain("67%");
    expect(html).toContain("La Cantina");
    expect(html).toContain("3 opens · created here");
  });

  it("an empty window reads as a dash, and an error says so", () => {
    const empty = renderToStaticMarkup(
      <PlaceOpensCard
        report={{
          ...report,
          summary: { ...report.summary, opens: 0, places: 0, profileRate: 0, repeated: [] },
        }}
      />,
    );
    expect(empty).toContain("No place has been opened twice yet.");
    expect(renderToStaticMarkup(<PlaceOpensCard report={{ ok: false, error: "nope" }} />)).toContain("nope");
  });
});
