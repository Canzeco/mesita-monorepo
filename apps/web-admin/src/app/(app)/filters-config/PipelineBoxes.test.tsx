import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "./catalog";
import {
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

import { CatalogBox, DeepBox, MapBox, NameAdminBox, NameBox } from "./PipelineBoxes";

const seed = { initialConfig: DEFAULT_CONFIG, initialUpdatedAt: null, loadError: null };
const render = (node: React.ReactElement) => renderToStaticMarkup(node);
const page = () =>
  render(
    <>
      <NameAdminBox {...seed} />
      <NameBox {...seed} />
      <MapBox {...seed} />
      <CatalogBox {...seed} />
      <DeepBox />
    </>,
  );
const boxes = () => page().split("<section ").slice(1);

describe("Discovery: one page, five pipeline boxes (MESITA-2327)", () => {
  it("is Admin Name, Consumer Name, Consumer Map, Consumer Catalog, Consumer Deep, in that order (MESITA-2779, MESITA-2909)", () => {
    const html = page();
    let last = -1;
    // Deep's title carries its Soon chip inside the heading.
    for (const title of [">Admin Name Pipeline</h2>", ">Consumer Name Pipeline</h2>", ">Consumer Map Pipeline</h2>", ">Consumer Catalog Pipeline</h2>", ">Consumer Deep Pipeline "]) {
      const at = html.indexOf(title);
      expect(at, title).toBeGreaterThan(last);
      last = at;
    }
    expect(boxes()).toHaveLength(5);
  });

  it("every live box is the same card: Explanation, Sources, Signals, Scoring, Parameters", () => {
    for (const box of boxes().slice(0, 4)) {
      const parts = ["Explanation", "Sources", "Signals", "Scoring", "Parameters"].map((p) =>
        box.indexOf(`>${p}<`),
      );
      expect(parts.every((at) => at > -1)).toBe(true);
      expect([...parts].sort((a, b) => a - b)).toEqual(parts);
    }
  });

  it("the Map box shows both Gates, the Catalog box only Family (MESITA-2909)", () => {
    const [nameAdmin, name, map, catalog] = boxes();
    for (const box of [nameAdmin, name]) expect(box).not.toContain(">Gates<");
    for (const gate of DISCOVERY_GATES) expect(map).toContain(gate.rule);
    const rule = (key: string) => DISCOVERY_GATES.find((g) => g.key === key)!.rule;
    expect(catalog).toContain(rule("family"));
    expect(catalog).not.toContain(rule("radius"));
  });

  it("names each pipeline's signals with their formula and missing-data policy", () => {
    const [nameAdmin, name, map, catalog] = boxes();
    const has = (box: string, key: string) => {
      const s = DISCOVERY_SIGNALS.find((x) => x.key === key)!;
      // renderToStaticMarkup escapes text; compare on a fragment with no
      // escapable characters.
      expect(box).toContain(`>${s.label}<`);
      expect(box).toContain(s.missing.split(":")[0]);
    };
    // The Map ranks by Popularity alone (MESITA-2909).
    has(map, "popularity");
    expect(map).not.toContain(">Proximity<");
    has(catalog, "proximity");
    has(catalog, "popularity");
    // Name is Google's alone (MESITA-2896): its Signals part says None.
    for (const box of [nameAdmin, name]) expect(box).toContain("None: no signal scores these rows");
    expect(name).not.toContain(">Proximity<");
  });

  it("'Fed by' is derived from the sources' fields, never typed", () => {
    // Autocomplete gives no coordinates, so it can never feed Proximity.
    expect(sourcesFeedingSignal("catalog", "proximity")).toEqual(["mesita_places"]);
    expect(sourcesFeedingSignal("deep", "description_similarity")).toEqual(["mesita_places"]);
    const catalog = boxes()[3];
    expect(catalog).toContain(`Fed by ${sourceByKey("mesita_places").label}.`);
  });

  it("nothing on the page shows Not wired: the only unwired source sits in the Soon Deep box", () => {
    expect(page()).not.toContain("Not wired");
  });

  it("carries no weights table and no subpage tabs", () => {
    // 2 Name by Admin + 3 Name + Map: the current-location radius, Most
    // pins shown, Minimum Popularity, the reload seconds and min screen
    // move + Catalog: the half distance, the distance exponent, the
    // Popularity root (MESITA-3083) and the page size (MESITA-2909; the
    // Selected boost retired, MESITA-2925). Typed numbers, no spinner
    // (MESITA-2733).
    const html = page();
    expect(html.match(/type="text"/g)?.length).toBe(14);
    expect(html.match(/inputMode="decimal"/g)?.length).toBe(8);
    expect(html.match(/inputMode="numeric"/g)?.length).toBe(6);
    expect(html).not.toContain('type="number"');
    expect(html).not.toContain("step=");
    expect(html).not.toContain("Distance penalty");
    expect(html).not.toContain("Catalog places shown");
    expect(html).not.toContain("Proximity weight (a)");
    expect(html).not.toContain("data-area-weights");
    expect(html).not.toContain("Modes");
    expect(html).not.toContain('role="tablist"');
  });
});

describe("the boxes' controls", () => {
  it("Name by Admin: two caps and the empty-query switch", () => {
    const html = render(<NameAdminBox {...seed} />);
    for (const label of [
      "Max Autocomplete rows",
      "Max Text Search rows",
      "Show results on an empty query",
    ]) {
      expect(html).toContain(label);
    }
  });

  it("Name: idle seconds, three caps, Locations; no Active switch, no second reviews floor (MESITA-2702)", () => {
    const html = render(<NameBox {...seed} />);
    expect(html).toContain("Seconds without typing before the search runs");
    expect(html).not.toContain("Minimum number of Google reviews");
    expect(html).toContain('aria-label="Show Locations"');
    expect(html).not.toContain("Only active places");
  });

  it("Map and Catalog: the Always-on rules state no Google call and the fixed numbers (MESITA-2603, MESITA-2872, MESITA-2909)", () => {
    const map = render(<MapBox {...seed} />);
    for (const text of ["the Map calls no Google", "has no ceiling"]) {
      expect(map, text).toContain(text);
    }
    const catalog = render(<CatalogBox {...seed} />);
    expect(catalog).toContain("no Google call");
    expect(catalog).not.toContain("Mesita Proximity");
    for (const html of [map, catalog]) {
      expect(html).not.toContain("Nearby call");
      expect(html).not.toContain("Google Popularity");
    }
  });

  it("Deep is Soon: title, one line and the chip, its controls deleted from the markup (MESITA-2345)", () => {
    const html = render(<DeepBox />);
    expect(html).toContain(">Consumer Deep Pipeline");
    expect(html).toContain("Soon");
    expect(html).toContain('id="s-deep"');
    for (const gone of ["Places handed to Chat", "Minimum Description score", "Chat Agent prompt", "<textarea", 'type="number"', 'type="text"', ">Save<", ">Sources<", ">Signals<"]) {
      expect(html).not.toContain(gone);
    }
  });
});

describe("the boxes tell the runtime's truth (MESITA-2338)", () => {
  it("every box lists its always-on rules; Name's include Mesita's place types", () => {
    const [nameAdmin, name, map, catalog] = boxes();
    for (const box of [nameAdmin, name, map, catalog]) expect(box).toContain(">Always-on rules<");
    expect(name).toContain("A Google row must have a Google type of one of the thirty-seven families");
    expect(map).toContain("It decides who is a candidate and never scores.");
  });

  it("Name says Google rows keep Google's order and has no Mesita source (MESITA-2896)", () => {
    const name = boxes()[1];
    expect(name).toContain("No signal scores its rows; they carry Google Autocomplete&#x27;s own rank.");
    expect(name).not.toContain("Mesita Places Search");
    expect(name).not.toContain("Fed by");
  });

  it("each signal shows its computation, normalization and the pipelines using it", () => {
    const catalog = boxes()[3];
    expect(catalog).toContain("Normalization:");
    expect(catalog).toContain("Computed at request time");
    expect(catalog).toContain("Used by Catalog.");
  });

  it("Name by Admin shows Find's own ordering and rules, not the guest bar's", () => {
    const nameAdmin = boxes()[0];
    expect(nameAdmin).toContain("Rows found by both sources come first");
    expect(nameAdmin).toContain("Text Search rows are Find&#x27;s own call");
    expect(nameAdmin).not.toContain("Closed places never show (Discovery");
  });
});
