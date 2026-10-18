import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "./catalog";
import { CATALOG_FAMILY_FACTS, CATALOG_SIGNAL_RAILS } from "./discovery-surface";

// Keeps the "use server" actions.ts out of the graph; never called (static
// render runs no effects).
vi.mock("./actions", () => ({
  getDiscoveryConfig: vi.fn(),
  updateDiscoveryConfig: vi.fn(),
}));

import { DiscoveryModesView } from "./modes/page";
import { PlacesBox, WordAdminBox, WordBox } from "./ModeBoxes";

const seed = { initialConfig: DEFAULT_CONFIG, initialUpdatedAt: null, loadError: null };
const modes = () => renderToStaticMarkup(<DiscoveryModesView seed={seed} />);

describe("Discovery › Modes (MESITA-2303)", () => {
  it("is six boxes in order", () => {
    const html = modes();
    const titles = ["Word by Admin", "Word", "Map", "Places", "Social", "Chat"];
    let last = -1;
    for (const title of titles) {
      const idx = html.indexOf(`>${title}</h2>`);
      expect(idx, title).toBeGreaterThan(last);
      last = idx;
    }
    expect(html.match(/<section /g)?.length).toBe(6);
  });

  it("every box has Explanation, Sources, then Parameters", () => {
    for (const box of modes().split("<section ").slice(1)) {
      const e = box.indexOf(">Explanation<");
      const s = box.indexOf(">Sources<");
      const p = box.indexOf(">Parameters<");
      expect(e).toBeGreaterThan(-1);
      expect(s).toBeGreaterThan(e);
      expect(p).toBeGreaterThan(s);
    }
  });

  it("never says Fast, Deep or Enriched to the operator as a mode word", () => {
    const html = modes();
    expect(html).not.toMatch(/Fast Search|Deep Search/);
    expect(html).not.toContain("Matrix");
  });

  it("a knob nothing reads shows Not wired and stores no value", () => {
    const html = renderToStaticMarkup(<WordAdminBox />);
    expect(html.match(/Not wired/g)?.length).toBe(4);
    expect(html).not.toContain("<input");
  });

  it("Word binds the deep caps and the General gate", () => {
    const html = renderToStaticMarkup(<WordBox {...seed} />);
    expect(html).toContain("Max Autocomplete rows");
    expect(html).toContain("Only active places");
    expect(html).toContain("Minimum number of Google reviews");
    expect(html.match(/Not wired/g)?.length).toBe(2);
  });
});

describe("Places box", () => {
  it("lists Google Places, Mesita Selected, then every family in Feed order", () => {
    const html = renderToStaticMarkup(<PlacesBox {...seed} />);
    const labels = [
      ...CATALOG_SIGNAL_RAILS.map((rail) => rail.label),
      ...CATALOG_FAMILY_FACTS.map((family) => family.label),
    ];
    expect(labels.slice(0, 2)).toEqual(["Google Places", "Mesita Selected"]);
    let last = -1;
    for (const label of labels) {
      const idx = html.indexOf(`</span> ${label}</li>`);
      expect(idx, label).toBeGreaterThan(last);
      last = idx;
    }
  });

  it("Mesita Selected weighs only Proximity and Popularity; Google Places reads the Map mask", () => {
    const html = renderToStaticMarkup(<PlacesBox {...seed} />);
    expect(html).toContain('aria-label="Proximity · Mesita Selected"');
    expect(html).toContain('aria-label="Popularity · Mesita Selected"');
    expect(html).not.toContain('aria-label="Timing · Mesita Selected"');
    expect(html).toContain('aria-label="Timing · Google Places"');
    expect(html).not.toContain('aria-label="Randomness · Google Places"');
  });
});
