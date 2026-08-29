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
  it("Fast is Google places + Max results; Deep is four independent queries", () => {
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
    expect(html).toContain("Google Autocomplete");
    expect(html).toContain("Google Text Search");
    expect(html).toContain("Mesita partners");
    expect(html).toContain("Mesita places");
    expect(html).toContain("Deep never calls Nearby Search");
    expect(html).not.toContain("Google Places Nearby Search");
    expect(html).toContain("Map Filters never cut this list");
    expect(html).toContain(
      "Then concat. Autocomplete → Text Search → Mesita Places → Mesita Partners.",
    );
    expect(html).toContain("Queries");
    expect(html).not.toContain("Bring");
    expect(html).toContain('value="5"');
    expect(html).toContain('value="3"');
    expect(html).not.toContain('value="9"');

    const box = (src: string, label: string) =>
      src.search(new RegExp(`${label}\\s*</span>`));

    const fastHtml = html.slice(
      html.indexOf("Name (Fast Search)"),
      html.indexOf("Name (Deep Search)"),
    );
    expect(box(fastHtml, "Google places")).toBeLessThan(
      box(fastHtml, "Max results"),
    );
    expect(fastHtml).toContain("Max results");

    const deepHtml = html.slice(html.indexOf("Name (Deep Search)"));
    expect(box(deepHtml, "Google Autocomplete")).toBeLessThan(
      box(deepHtml, "Google Text Search"),
    );
    expect(box(deepHtml, "Google Text Search")).toBeLessThan(
      box(deepHtml, "Mesita places"),
    );
    expect(box(deepHtml, "Mesita places")).toBeLessThan(
      box(deepHtml, "Mesita partners"),
    );
    expect(deepHtml).not.toContain("Max results");
    expect(deepHtml.indexOf("Queries")).toBeLessThan(
      box(deepHtml, "Google Autocomplete"),
    );
  });
});
