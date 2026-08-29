import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DiscoveryMatrix } from "./DiscoveryMatrix";

describe("Discovery matrix", () => {
  it("marks Name (Deep) × Nearby Search red — Deep does not call that API", () => {
    const html = renderToStaticMarkup(<DiscoveryMatrix />);
    expect(html).toContain(
      "Google Places Nearby Search · Name (Deep) · off",
    );
    expect(html).not.toContain(
      "Google Places Nearby Search · Name (Deep) · on",
    );
    expect(html).toContain("Google Places Nearby Search · Map · on");
    expect(html).toContain(
      "Google Places Autocomplete · Name (Deep) · on",
    );
    expect(html).toContain(
      "Google Places Text Search · Name (Deep) · on",
    );
    expect(html).toContain("Mesita Listed · Favorites · not required");
    expect(html).toContain("Mesita Enriched · Favorites · not required");
    expect(html).toContain("Google Places · Favorites · required");
    expect(html).toContain("border-foreground border-b-2");
  });
});
