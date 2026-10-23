import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GuestOpensCard } from "./GuestOpensCard";

describe("GuestOpensCard", () => {
  it("renders open counters", () => {
    const html = renderToStaticMarkup(
      <GuestOpensCard
        windowDays={30}
        capped={false}
        names={{}}
        summary={{
          opens: 2,
          places: 1,
          profileRate: 0.5,
          byOutcome: { existing: 1, created: 1, refused: 0, failed: 0 },
          repeated: [],
        }}
      />,
    );
    expect(html).toContain("Opens from Google");
    expect(html).toContain("2");
  });
});
