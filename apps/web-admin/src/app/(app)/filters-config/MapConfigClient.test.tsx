import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_CONFIG, MAP_RELOAD_PAIRS } from "./catalog";

vi.mock("./actions", () => ({
  getDiscoveryConfig: vi.fn(async () => ({
    ok: true,
    config: DEFAULT_CONFIG,
    updatedAt: "2026-08-28T00:00:00.000Z",
  })),
  updateDiscoveryConfig: vi.fn(),
}));

import { MapConfigClient } from "./MapConfigClient";

describe("Map reload pairs", () => {
  it("offers incremental km+sec pairs and defaults to 0.5 km · 2s", () => {
    const html = renderToStaticMarkup(
      <MapConfigClient
        initialConfig={DEFAULT_CONFIG}
        initialUpdatedAt="2026-08-28T00:00:00.000Z"
        loadError={null}
      />,
    );
    // No Queries block, no per-set count field, no cap constants — the ONE
    // count here is How many pins, and it is a stop, not a free number.
    expect(html).not.toContain("Queries");
    expect(html).not.toContain("Bring");
    expect(html).not.toContain(
      "Places scope picks one set. Closest N of that set. Inner membership paints — not extra pins.",
    );
    expect(html).not.toContain("Google places");
    expect(html).not.toContain("Mesita places");
    expect(html).not.toContain("Mesita partners");
    // HOW MANY PINS IS THE OPERATOR'S AGAIN (MESITA-1699): the guest's
    // Search Filters sheet is deleted, so this box is where the number is
    // asked, and the copy must not still call it the guest's question.
    expect(html).toContain("How many pins");
    expect(html).not.toContain("How many pins is the guest");
    for (const stop of ["20", "40", "60"]) expect(html).toContain(stop);
    // The console must say what the sets ARE, not just name them: an
    // operator reading "Mesita Places" would price it at every row. The
    // chain and its gate are both stated (Pato, 2026-09-05).
    expect(html).toContain("Three nested sets");
    expect(html).toContain("Mesita Enriched Places");
    expect(html).toContain("Mesita Partner Places");
    expect(html).toContain("Enrichment gates every Mesita ring");
    expect(html).toContain("never a search source");
    expect(html).toContain("Places sets");
    expect(html).toContain("Closest N of the selected set");
    expect(html).toContain("Listed pins then Lineup, not distance");
    expect(html).toContain("Reload after");
    expect(html).toContain("AND wait this long");
    expect(html).toContain("Only dragging the map counts");
    expect(html).toMatch(/Reload after[\s\S]*aria-pressed/);
    expect(html).not.toContain("Reload after the camera moves");
    expect(html).not.toContain("Reload after waiting");
    for (const pair of MAP_RELOAD_PAIRS) {
      expect(html).toContain(`${pair.km} km · ${pair.sec}s`);
    }
    expect(html).toMatch(/aria-pressed="true"[^>]*>0\.5 km · 2s/);
    expect(MAP_RELOAD_PAIRS).toEqual([
      { km: 0.25, sec: 1 },
      { km: 0.5, sec: 2 },
      { km: 1, sec: 4 },
      { km: 2, sec: 8 },
      { km: 4, sec: 15 },
    ]);
  });
});
