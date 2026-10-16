import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DiscoveryMatrix } from "./DiscoveryMatrix";
import { DISCOVERY_MODES, DISCOVERY_SOURCES } from "./discovery-surface";

describe("Discovery matrix", () => {
  it("renders every runtime source against every runtime mode, read-only", () => {
    const html = renderToStaticMarkup(<DiscoveryMatrix />);
    expect(DISCOVERY_SOURCES).toHaveLength(7);
    expect(DISCOVERY_MODES).toHaveLength(6);
    for (const source of DISCOVERY_SOURCES) {
      expect(html).toContain(source.label);
    }
    for (const mode of DISCOVERY_MODES) {
      expect(html).toContain(mode.label);
    }
    expect(html).toContain("Google Places Autocomplete Search · Word · calls");
    expect(html).toContain("Google Places Text Search · Word · calls");
    expect(html).toContain("Mesita Places Name Search · Word · calls");
    expect(html).toContain("Google Places Nearby Search · Word · does not call");
    expect(html).toContain("Google Places Nearby Search · Map · calls");
    expect(html).toContain("Mesita Places Nearby Search · Map · calls");
    expect(html).toContain("Mesita Places Catalog Search · Catalog · calls");
    expect(html).toContain("Mesita Places Catalog Search · Swipe · calls");
    expect(html).toContain("Mesita Places Catalog Search · Chat · does not call");
    expect(html).toContain("Mesita Social Catalog Search · Catalog · does not call");
    expect(html).toContain("Mesita Social Catalog Search · Chat · does not call");
    expect(html).toContain("Unavailable");
    expect(html).toContain("Fixed");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("Browse Search");
    expect(html).not.toContain("Flexible Search");
    expect(html).not.toContain("Scroll");
    expect(html).toContain("bg-foreground");
    expect(html).toContain("sr-only");
    expect(html).not.toContain("emerald");
    expect(html).not.toContain("rose");
  });
});
