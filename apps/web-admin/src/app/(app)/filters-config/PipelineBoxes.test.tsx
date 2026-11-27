import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "./catalog";
import { DISCOVERY_GATES, sourceByKey, sourcesFeedingSignal } from "./discovery-surface";

// Keeps the "use server" actions.ts out of the graph; never called (static
// render runs no effects).
vi.mock("./actions", () => ({
  getDiscoveryConfig: vi.fn(),
  updateDiscoveryConfig: vi.fn(),
}));

import {
  HowRankedCard,
  MapDisplayBox,
  MixingBox,
  RankingBox,
  SearchbarsBox,
} from "./PipelineBoxes";

const seed = { initialConfig: DEFAULT_CONFIG, initialUpdatedAt: null, loadError: null };
const render = (node: React.ReactElement) => renderToStaticMarkup(node);

// Discovery is one page of five cards (MESITA-4454); each card saves only
// its own slices (actions.test.ts). These pin what the runtime model says,
// never copy or layout (the MVP test rule).
describe("the How places are ranked card draws the runtime model (MESITA-2338)", () => {
  const how = () => render(<HowRankedCard />);

  it("carries the Catalog's and the Map's gates, derived from the model", () => {
    const html = how();
    for (const gate of DISCOVERY_GATES) expect(html).toContain(gate.rule);
  });

  it("'Fed by' is derived from the sources' fields, never typed", () => {
    // Autocomplete gives no coordinates, so it can never feed Proximity.
    expect(sourcesFeedingSignal("catalog", "proximity")).toEqual(["mesita_places"]);
    expect(sourcesFeedingSignal("deep", "description_similarity")).toEqual(["mesita_places"]);
    expect(how()).toContain(`Fed by ${sourceByKey("mesita_places").label}.`);
  });

  it("nothing on the page shows Not wired: the only unwired source was Deep's, off the page (MESITA-3828)", () => {
    const page = [
      how(),
      render(<RankingBox {...seed} />),
      render(<MixingBox {...seed} />),
      render(<MapDisplayBox {...seed} />),
      render(<SearchbarsBox {...seed} />),
    ].join("");
    expect(page).not.toContain("Not wired");
  });
});

describe("Ranking shows every lane row (MESITA-4454, MESITA-4517)", () => {
  it("renders without a page stamp and offers no field the server forces (C1, L-1)", () => {
    const html = render(<RankingBox {...seed} />);
    // MESITA-5030: 3 Home organic × 5, 3 Home inorganic × 6, 2 Map organic × 2,
    // 2 Map inorganic × 3, Pay and Prepay × 7. Premier is fixed on organic.
    // Offers is fixed except on Pay and Prepay. Map has no batch or distance.
    expect(html.match(/<input/g)?.length).toBe(3 * 5 + 3 * 6 + 2 * 2 + 2 * 3 + 2 * 7);
    for (const name of ["Home Nearby Organic", "Map Popular Inorganic", "Pay", "Prepay", "½ at 0.1 km", ">Lane<"]) {
      expect(html).toContain(name);
    }
    expect(html).not.toContain("Local Favorites");
    expect(html).not.toContain("Foursquare factor");
  });
});
