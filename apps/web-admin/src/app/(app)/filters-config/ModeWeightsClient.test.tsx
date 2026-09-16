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
    expect(markup).toContain(">Map<");
    expect(markup).toContain(">Scroll<");
    // WORD IS THE POINT OF THIS TEST. It calls weightsForMode twice, so a
    // caller-set rule would give it a column — but its mask is one signal,
    // and a one-factor Π s^w is a monotone transform of s, so no exponent can
    // reorder a Word result. Feed ranks by cosine; Chat and Favorites have no
    // engine, and Favorites' mask is empty besides.
    for (const absent of ["Word", "Feed", "Chat", "Favorites"]) {
      expect(markup, absent).not.toContain(`>${absent}<`);
    }
    // Two columns, so two inputs per on-signal and no more. Twelve, not
    // thirteen: Map × Partnered is zeroed too, because Map prices partnership
    // by splitting lanes rather than by an exponent.
    const inputs = markup.match(/<input/g)?.length ?? 0;
    expect(inputs).toBe(12);
  });

  it("labels every input with its signal AND its mode", () => {
    const markup = html();
    expect(markup).toContain('aria-label="Proximity weight · Scroll"');
    expect(markup).toContain('aria-label="Proximity weight · Map"');
    expect(markup).toContain('aria-label="Randomness weight · Scroll"');
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
    expect(markup).toContain("Randomness weight · Map · off");
    expect(markup).not.toContain('aria-label="Randomness weight · Map"');
    // Word-only signals are off on both columns.
    expect(markup).toContain("Name weight · Map · off");
    expect(markup).toContain("Name weight · Scroll · off");
    // Map × Partnered, same reason on a different argument: the lane split
    // in reorderListedLanes already prices the fact, so an editable box here
    // was a knob an operator could set, Save, and watch change nothing.
    expect(markup).toContain("Partnered weight · Map · off");
    expect(markup).not.toContain('aria-label="Partnered weight · Map"');
    // Scroll ranks one deck with no lane split, so its box stays real.
    expect(markup).toContain('aria-label="Partnered weight · Scroll"');
    expect(markup).toContain("—");
    expect(markup).not.toContain(">0</span>");
  });

  it("prints each field's visible range, because the clamp is silent", () => {
    const markup = html();
    // Partnered and Enriched cap at 2, not the uniform 4 — money may not
    // become a sort key from the console.
    expect(markup).toContain("0–2");
    expect(markup).toContain("0–4");
    expect(markup).toContain('max="2"');
    expect(markup).toContain('max="4"');
  });

  it("gives each column a state badge that names its reader", () => {
    const markup = html();
    // Scroll always ranks; Map ranks only on the no-Google-fill branch, so
    // Enforced would overclaim and Not wired would underclaim.
    expect(markup).toContain("consumer-web-recommend-swipe ranks every deck");
    expect(markup).toContain(
      "consumer-web-list-places ranks only when Google fill returns nothing",
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
