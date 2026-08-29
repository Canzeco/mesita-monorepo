import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_CONFIG } from "./catalog";

vi.mock("./actions", () => ({
  getDiscoveryConfig: vi.fn(async () => ({
    ok: true,
    config: DEFAULT_CONFIG,
    updatedAt: "2026-08-28T00:00:00.000Z",
  })),
  updateDiscoveryConfig: vi.fn(),
}));

import { NameConfigClient } from "./NameConfigClient";

describe("Name Search params", () => {
  it("Fast is Google places + Max results; Deep is three lanes + merge max", () => {
    const html = renderToStaticMarkup(
      <NameConfigClient
        initialConfig={DEFAULT_CONFIG}
        initialUpdatedAt="2026-08-28T00:00:00.000Z"
        loadError={null}
      />,
    );
    expect(html).toContain("Name (Fast Search)");
    expect(html).toContain("Name (Deep Search)");
    expect(html).toContain("Google places");
    expect(html).toContain("Mesita partners");
    expect(html).toContain("Mesita places");
    expect((html.match(/Max results/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("Max results caps the merge");
    expect(html).toContain("Map Filters never cut this list");
    expect(html).toContain('value="5"');
    expect(html).toContain('value="3"');
    expect(html).toContain('value="9"');

    const fastHtml = html.slice(
      html.indexOf("Name (Fast Search)"),
      html.indexOf("Name (Deep Search)"),
    );
    expect(fastHtml.indexOf("Google places")).toBeLessThan(
      fastHtml.indexOf("Max results"),
    );

    const deepHtml = html.slice(html.indexOf("Name (Deep Search)"));
    const google = deepHtml.indexOf("Google places");
    const partners = deepHtml.indexOf("Mesita partners");
    const places = deepHtml.indexOf("Mesita places");
    const max = deepHtml.indexOf("Max results");
    expect(google).toBeLessThan(partners);
    expect(partners).toBeLessThan(places);
    expect(places).toBeLessThan(max);
  });
});
