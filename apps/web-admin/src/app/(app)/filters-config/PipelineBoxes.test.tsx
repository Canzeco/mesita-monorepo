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

import { AreaBox, DeepBox, NameAdminBox, NameBox } from "./PipelineBoxes";

const seed = { initialConfig: DEFAULT_CONFIG, initialUpdatedAt: null, loadError: null };
const render = (node: React.ReactElement) => renderToStaticMarkup(node);
const page = () =>
  render(
    <>
      <NameAdminBox {...seed} />
      <NameBox {...seed} />
      <AreaBox {...seed} />
      <DeepBox />
    </>,
  );
const boxes = () => page().split("<section ").slice(1);

describe("Discovery: one page, four pipeline boxes (MESITA-2327)", () => {
  it("is Name by Admin, Name, Area, Deep, in that order", () => {
    const html = page();
    let last = -1;
    // Deep's title carries its Soon chip inside the heading.
    for (const title of [">Name Pipeline by Admin</h2>", ">Name Pipeline</h2>", ">Area Pipeline</h2>", ">Deep Pipeline "]) {
      const at = html.indexOf(title);
      expect(at, title).toBeGreaterThan(last);
      last = at;
    }
    expect(boxes()).toHaveLength(4);
  });

  it("every live box is the same card: Explanation, Sources, Signals, Scoring, Parameters", () => {
    for (const box of boxes().slice(0, 3)) {
      const parts = ["Explanation", "Sources", "Signals", "Scoring", "Parameters"].map((p) =>
        box.indexOf(`>${p}<`),
      );
      expect(parts.every((at) => at > -1)).toBe(true);
      expect([...parts].sort((a, b) => a - b)).toEqual(parts);
    }
  });

  it("only the Area box shows Gates, and both of them", () => {
    const [nameAdmin, name, area] = boxes();
    for (const box of [nameAdmin, name]) expect(box).not.toContain(">Gates<");
    expect(area).toContain(">Gates<");
    for (const gate of DISCOVERY_GATES) expect(area).toContain(gate.rule);
  });

  it("names each pipeline's signals with their formula and missing-data policy", () => {
    const [, name, area] = boxes();
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
    expect(name).not.toContain(">Proximity<");
  });

  it("'Fed by' is derived from the sources' fields, never typed", () => {
    // Autocomplete gives no coordinates, so it can never feed Proximity.
    expect(sourcesFeedingSignal("area", "proximity")).toEqual(["google_nearby", "mesita_places"]);
    expect(sourcesFeedingSignal("deep", "description_similarity")).toEqual(["mesita_places"]);
    const area = boxes()[2];
    expect(area).toContain(`Fed by ${sourceByKey("google_nearby").label} · ${sourceByKey("mesita_places").label}.`);
  });

  it("nothing on the page shows Not wired: the only unwired source sits in the Soon Deep box", () => {
    expect(page()).not.toContain("Not wired");
  });

  it("carries the one weights table and no subpage tabs", () => {
    // 3 Name by Admin + 5 Name + 5 Area (the reach, MESITA-2431; Selected's
    // other value, MESITA-2439) + the Area weights table's 9 (three modes ×
    // three signals, MESITA-2428 and MESITA-2439); Deep is Soon.
    const html = page();
    expect(html.match(/type="number"/g)?.length).toBe(22);
    expect(html.match(/data-area-weights/g)?.length).toBe(1);
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

  it("Area: radius, reach, half credit, Selected's other value, the weights table, two source counts, no total and no Feed rows (MESITA-2379, MESITA-2428, MESITA-2431, MESITA-2439)", () => {
    const html = render(<AreaBox {...seed} />);
    for (const label of [
      "Radius (km)",
      "Proximity reach (km)",
      "Reviews for half credit",
      "Weights table",
      "📍 Nearby",
      "⭐ Popular",
      "Family",
      "Selected for every other place",
      "Proximity (a)",
      "Popularity (b)",
      "Selected (c)",
      "Google candidates",
      "Mesita candidates",
      "Reload after",
    ]) {
      expect(html).toContain(label);
    }
    for (const dead of [
      "half distance",
      "reference rating",
      "reference reviews",
      "How many pins",
      "Proximity weight",
      "Popularity weight",
      "Places per row",
      'aria-label="Feed rows"',
      "Total",
      "The guest picks",
      "scope",
      "subset",
      "Popularity × Selected",
      "Factors",
    ]) {
      expect(html, dead).not.toContain(dead);
    }
    expect(html).toContain('value="100"');
    // Proximity's reach defaults to 15 km, apart from the 50 km radius (MESITA-2431).
    expect(html).toContain('value="15"');
    // The weights table's defaults (MESITA-2439): Nearby 4 · 1 · 1, Popular 1 · 3 · 1.
    expect(html).toContain('value="4"');
    expect(html).toContain('value="3"');
    expect(html).toContain('value="0.3"');
    // 40 and 60 are bought now: every Google stop is a live pill.
    const google = html.slice(html.indexOf("Places Mesita buys for Home&#x27;s catalog"), html.indexOf("Ready Mesita places read"));
    expect(google).toContain("up to 1 / 2 / 3 billed Nearby calls");
    expect(google.match(/<button[^>]*disabled=""[^>]*>(20|40|60)<\/button>/g)).toBeNull();
  });

  it("Area draws its gates, Selected as its third signal and the point/area rule (MESITA-2439)", () => {
    const html = render(<AreaBox {...seed} />);
    for (const text of ["Family", "Territory", "1.0 for a Mesita Selected place", "0.3 for every other place", "Selected<sup>c</sup>", "Chat reads Mesita Selected places only."]) {
      expect(html, text).toContain(text);
    }
    expect(html).toContain("A point location uses Proximity and the radius; an area location uses Territory. Never both.");
  });

  it("Deep is Soon: title, one line and the chip, its controls deleted from the markup (MESITA-2345)", () => {
    const html = render(<DeepBox />);
    expect(html).toContain(">Deep Pipeline");
    expect(html).toContain("Soon");
    expect(html).toContain('id="s-deep"');
    for (const gone of ["Places handed to Chat", "Minimum Description score", "Chat Agent prompt", "<textarea", 'type="number"', ">Save<", ">Sources<", ">Signals<"]) {
      expect(html).not.toContain(gone);
    }
  });
});

describe("the boxes tell the runtime's truth (MESITA-2338)", () => {
  it("every box lists its always-on rules; Name's include Mesita's place types", () => {
    const [nameAdmin, name, area] = boxes();
    for (const box of [nameAdmin, name, area]) expect(box).toContain(">Always-on rules<");
    expect(name).toContain("A Google row must have a Google type of one of the thirteen families");
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
