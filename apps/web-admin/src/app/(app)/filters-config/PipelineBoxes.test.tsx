import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "./catalog";
import {
  CATALOG_FAMILY_FACTS,
  CATALOG_SIGNAL_RAILS,
  DISCOVERY_GATES,
  DISCOVERY_SIGNALS,
  sourceByKey,
  sourcesFeedingSignal,
} from "./discovery-surface";

// Keeps the "use server" actions.ts out of the graph; never called (static
// render runs no effects).
vi.mock("./actions", () => ({
  getDiscoveryConfig: vi.fn(),
  updateDiscoveryConfig: vi.fn(),
}));

import { AreaBox, DeepBox, NameAdminBox, NameBox } from "./PipelineBoxes";

const seed = { initialConfig: DEFAULT_CONFIG, initialUpdatedAt: null, loadError: null };
const render = (node: React.ReactElement) => renderToStaticMarkup(node);
const page = () =>
  render(
    <>
      <NameAdminBox {...seed} />
      <NameBox {...seed} />
      <AreaBox {...seed} />
      <DeepBox {...seed} />
    </>,
  );
const boxes = () => page().split("<section ").slice(1);

describe("Discovery: one page, four pipeline boxes (MESITA-2327)", () => {
  it("is Name by Admin, Name, Area, Deep, in that order", () => {
    const html = page();
    let last = -1;
    for (const title of ["Name Pipeline by Admin", "Name Pipeline", "Area Pipeline", "Deep Pipeline"]) {
      const at = html.indexOf(`>${title}</h2>`);
      expect(at, title).toBeGreaterThan(last);
      last = at;
    }
    expect(boxes()).toHaveLength(4);
  });

  it("every box is the same card: Explanation, Sources, Signals, Scoring, Parameters", () => {
    for (const box of boxes()) {
      const parts = ["Explanation", "Sources", "Signals", "Scoring", "Parameters"].map((p) =>
        box.indexOf(`>${p}<`),
      );
      expect(parts.every((at) => at > -1)).toBe(true);
      expect([...parts].sort((a, b) => a - b)).toEqual(parts);
    }
  });

  it("only the Area box shows Gates, and both of them", () => {
    const [nameAdmin, name, area, deep] = boxes();
    for (const box of [nameAdmin, name, deep]) expect(box).not.toContain(">Gates<");
    expect(area).toContain(">Gates<");
    for (const gate of DISCOVERY_GATES) expect(area).toContain(gate.rule);
  });

  it("names each pipeline's signals with their formula and missing-data policy", () => {
    const [, name, area, deep] = boxes();
    const has = (box: string, key: string) => {
      const s = DISCOVERY_SIGNALS.find((x) => x.key === key)!;
      // renderToStaticMarkup escapes text; compare on a fragment with no
      // escapable characters.
      expect(box).toContain(`>${s.label}<`);
      expect(box).toContain(s.missing.split(":")[0]);
    };
    has(name, "name_similarity");
    has(area, "proximity");
    has(area, "popularity");
    has(deep, "description_similarity");
    expect(name).not.toContain(">Proximity<");
    expect(deep).not.toContain(">Popularity<");
  });

  it("'Fed by' is derived from the sources' fields, never typed", () => {
    // Autocomplete gives no coordinates, so it can never feed Proximity.
    expect(sourcesFeedingSignal("area", "proximity")).toEqual(["google_nearby", "mesita_places"]);
    expect(sourcesFeedingSignal("deep", "description_similarity")).toEqual(["mesita_places"]);
    const area = boxes()[2];
    expect(area).toContain(`Fed by ${sourceByKey("google_nearby").label} · ${sourceByKey("mesita_places").label}.`);
  });

  it("only Mesita Social Search shows Not wired", () => {
    const html = page();
    expect(html.match(/Not wired/g)?.length).toBe(1);
    expect(boxes()[3]).toContain("Not wired");
  });

  it("carries no weight inputs and no subpage tabs", () => {
    // 3 Name by Admin + 5 Name + 6 Area + 2 Deep. A weight column would add
    // a number input per signal.
    const html = page();
    expect(html.match(/type="number"/g)?.length).toBe(16);
    expect(html).not.toContain("Modes");
    expect(html).not.toContain('role="tablist"');
  });
});

describe("the boxes' controls", () => {
  it("Name by Admin: three caps and the empty-query switch", () => {
    const html = render(<NameAdminBox {...seed} />);
    for (const label of [
      "Max Autocomplete rows",
      "Max Text Search rows",
      "Max Mesita rows",
      "Show results on an empty query",
    ]) {
      expect(html).toContain(label);
    }
  });

  it("Name: idle seconds, three caps, the reviews floor, Locations; no Active switch", () => {
    const html = render(<NameBox {...seed} />);
    expect(html).toContain("Seconds without typing before the search runs");
    expect(html).toContain("Minimum number of Google reviews");
    expect(html).toContain('aria-label="Show Locations"');
    expect(html).not.toContain("Only active places");
  });

  it("Area: radius, the three numbers, the two caps, both views (MESITA-2347)", () => {
    const html = render(<AreaBox {...seed} />);
    for (const label of [
      "Radius (km)",
      "Reviews for half credit",
      "Proximity weight",
      "Popularity weight",
      "Google places",
      "Mesita places",
      "Reload after",
      "Places per row",
    ]) {
      expect(html).toContain(label);
    }
    for (const dead of ["half distance", "reference rating", "reference reviews", "How many pins"]) {
      expect(html).not.toContain(dead);
    }
    expect(html).toContain('value="100"');
    expect(html).toContain('value="5"');
    // Google places above 20 are not bought yet: the pills exist, disabled.
    const google = html.slice(html.indexOf("Google places"), html.indexOf("Mesita places"));
    expect(google.match(/<button[^>]*disabled=""[^>]*>(40|60)<\/button>/g)?.length).toBe(2);
    expect(google).not.toMatch(/<button[^>]*disabled=""[^>]*>20<\/button>/);
  });

  it("Area lists Google Places, Mesita Selected, then every family in Feed order", () => {
    const html = render(<AreaBox {...seed} />);
    const list = html.slice(html.indexOf('aria-label="Feed rows"'));
    let last = -1;
    for (const label of [...CATALOG_SIGNAL_RAILS, ...CATALOG_FAMILY_FACTS].map((r) => r.label)) {
      const at = list.indexOf(` ${label}</li>`);
      expect(at, label).toBeGreaterThan(last);
      last = at;
    }
  });

  it("Deep: limit, floor and the Chat Agent prompt", () => {
    const html = render(<DeepBox {...seed} />);
    expect(html).toContain("Places handed to Chat");
    expect(html).toContain("Minimum Description score (0 to 1)");
    expect(html).toContain("Chat Agent prompt (Don Memo)");
  });
});

describe("the boxes tell the runtime's truth (MESITA-2338)", () => {
  it("every box lists its always-on rules; Name's include Mesita's place types", () => {
    const [nameAdmin, name, area, deep] = boxes();
    for (const box of [nameAdmin, name, area, deep]) expect(box).toContain(">Always-on rules<");
    expect(name).toContain("A Google row must have a Google type of one of the fifteen families");
    expect(area).toContain("Inside the radius");
  });

  it("Name says Google rows keep Google's order and derives Name as fed by Mesita only", () => {
    const name = boxes()[1];
    expect(name).toContain("No signal scores its rows; they carry Google Autocomplete&#x27;s own rank.");
    expect(name).toContain("Fed by Mesita Places Search.");
  });

  it("each signal shows its computation, normalization and the pipelines using it", () => {
    const area = boxes()[2];
    expect(area).toContain("Normalization:");
    expect(area).toContain("Computed at request time");
    expect(area).toContain("Used by Area.");
  });

  it("Name by Admin shows Find's own ordering and rules, not the guest bar's", () => {
    const nameAdmin = boxes()[0];
    expect(nameAdmin).toContain("Rows found by more sources come first");
    expect(nameAdmin).toContain("Text Search rows are Find&#x27;s own call");
    expect(nameAdmin).not.toContain("Closed places never show (Discovery");
  });
});
