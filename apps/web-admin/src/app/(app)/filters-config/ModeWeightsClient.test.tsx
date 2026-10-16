import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  getDiscoveryConfig: vi.fn(),
  updateDiscoveryConfig: vi.fn(),
}));

import { ModeWeightsClient } from "./ModeWeightsClient";
import { DEFAULT_CONFIG, SIGNAL_KEYS } from "./catalog";

function html() {
  return renderToStaticMarkup(
    <ModeWeightsClient
      initialConfig={DEFAULT_CONFIG}
      initialUpdatedAt={null}
      loadError={null}
    />,
  );
}

describe("Signal weights by mode", () => {
  it("has exactly two editable columns — the modes that can actually reorder", () => {
    const markup = html();
    expect(markup).toContain("Map ranking");
    expect(markup).toContain("Swipe ranking");
    // Word is one signal, so an exponent cannot reorder it. Catalog uses its
    // own profile. Chat and Favorites do not rank.
    for (const absent of ["Word ranking", "Catalog ranking", "Chat ranking", "Favorites ranking"]) {
      expect(markup, absent).not.toContain(absent);
    }
    // Two columns, so two inputs per on-signal and no more: five on Map
    // (Randomness is zeroed there) and six on Scroll.
    const inputs = markup.match(/<input/g)?.length ?? 0;
    expect(inputs).toBe(11);
  });

  it("labels every input with its signal AND its mode", () => {
    const markup = html();
    expect(markup).toContain('aria-label="Proximity weight · Swipe"');
    expect(markup).toContain('aria-label="Proximity weight · Map"');
    expect(markup).toContain('aria-label="Randomness weight · Swipe"');
    // Otherwise this is a table of boxes all called "Weight".
    expect(markup).not.toContain('aria-label="Weight"');
    for (const key of SIGNAL_KEYS) {
      expect(markup).not.toContain(`aria-label="${key}"`);
    }
  });

  it("renders a labelled em-dash where the mask is off — never a disabled 0", () => {
    const markup = html();
    // Map × Randomness is DISCOVERY_MODE_SIGNAL_ZERO: present on the mode at
    // weight 0, which is off, not a number anyone chose. A printed 0 in an
    // editable box would invite an operator to "turn it up".
    expect(markup).not.toContain('aria-label="Randomness weight · Map"');
    expect(markup).not.toContain('aria-label="Name weight · Map"');
    expect(markup).not.toContain('aria-label="Name weight · Swipe"');
    expect(markup).not.toContain(">0</span>");
  });

  it("prints each field's visible range, because the clamp is silent", () => {
    const markup = html();
    // Enriched caps at 2, not the uniform 4 — past that it is a filter, not
    // a weight.
    expect(markup).toContain("0–2");
    expect(markup).toContain("0–4");
    expect(markup).toContain('max="2"');
    expect(markup).toContain('max="4"');
  });

  it("gives each column a state badge that names its reader", () => {
    const markup = html();
    // Scroll always ranks; Map ranks only on the no-Google-fill branch, so
    // Enforced would overclaim and Not wired would underclaim.
    expect(markup).toContain("Ranks every deck");
    expect(markup).toContain(
      "Ranks listed pins only when Google returns nothing",
    );
    expect(markup).toContain("Enforced");
    expect(markup).toContain("Fallback");
  });

  it("offers Reset and Revert per column, and no preset library", () => {
    const markup = html();
    expect(markup.match(/Reset to defaults/g)?.length).toBe(2);
    // Revert only appears while that column is dirty; nothing is dirty here.
    expect(markup).not.toContain("Revert to saved");
    expect(markup).not.toContain("<select");
    // Two Saves, one per column.
    expect(markup.match(/>Save</g)?.length).toBe(2);
  });
});
