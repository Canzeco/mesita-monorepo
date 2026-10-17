import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ModeFactList } from "./ModeFactList";
import { SourcesBoard } from "./SourcesBoard";
import { DEFAULT_CONFIG } from "./catalog";
import { DISCOVERY_MODES, DISCOVERY_SOURCES } from "./discovery-surface";

describe("Discovery sources and modes", () => {
  it("renders the runtime source set and no legacy source", () => {
    const html = renderToStaticMarkup(
      <SourcesBoard
        seed={{
          initialConfig: DEFAULT_CONFIG,
          initialUpdatedAt: null,
          loadError: null,
        }}
      />,
    );
    expect(DISCOVERY_SOURCES).toHaveLength(7);
    for (const source of DISCOVERY_SOURCES) {
      expect(html).toContain(source.label);
    }
    expect(html).toContain("Unavailable");
    expect(html).not.toContain("Browse");
    expect(html).not.toContain("Flexible");
    expect(html).not.toContain("Perplexity");
  });

  it("renders every mode and gives Word no weight control", () => {
    const html = renderToStaticMarkup(<ModeFactList />);
    expect(DISCOVERY_MODES).toHaveLength(5);
    for (const mode of DISCOVERY_MODES) {
      expect(html).toContain(mode.label);
    }
    expect(html).toContain("There is no weight to edit.");
    expect(html).not.toContain("Swipe");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("Name, Description");
  });
});
