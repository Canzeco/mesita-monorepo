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
    expect(html).toContain("Queries");
    expect(html).not.toContain("Bring");
    expect(html).toContain(
      "Places scope picks one set. Closest N of that set. Inner membership paints — not extra pins.",
    );
    expect(html).not.toContain("Then concat. Closest Partners");
    expect(html).toContain("Closest N of the selected set");
    expect(html).toContain("Listed pins then Lineup, not distance");
    expect(html).toContain("Google places");
    expect(html).toContain("Mesita places");
    // TWO sets (Pato, 2026-08-29): Partners retired as a query — a partner
    // is a Mesita place painted yellow.
    expect(html).not.toContain("Mesita partners");
    const mesita = html.indexOf("Mesita places");
    const google = html.indexOf("Google places");
    expect(mesita).toBeLessThan(google);
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
